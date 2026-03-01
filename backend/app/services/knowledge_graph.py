"""
knowledge_graph.py — In-memory knowledge graph using NetworkX.

Nodes: entities (person, org, country, event, concept…)
Edges: typed relationships (leads, member_of, affects…)

Supports:
  - Entity upsert with fuzzy alias deduplication
  - Relationship upsert
  - Entity lookup (name + all relationships)
  - Neighborhood expansion (all entities within N hops)
  - Shortest-path between two entities

Public API:
    get_graph() -> KnowledgeGraph     # singleton
    kg.upsert_entity(...)
    kg.upsert_relationship(...)
    kg.get_entity(name) -> dict | None
    kg.get_neighborhood(name, depth=2) -> dict
    kg.find_path(name_a, name_b, max_depth=4) -> list[str] | None
    kg.search_entities(query) -> list[dict]
"""

import logging
import re
from functools import lru_cache
from typing import Optional

logger = logging.getLogger(__name__)


def _slugify(name: str) -> str:
    """Stable node ID from entity name."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower().strip()).strip("-")


class KnowledgeGraph:
    def __init__(self):
        import networkx as nx
        self._g = nx.MultiDiGraph()
        # name_lower → node_id  (for fast alias lookup)
        self._alias_map: dict[str, str] = {}

    # ─────────────────────────────────────────────────────────
    # Internal resolution
    # ─────────────────────────────────────────────────────────

    def _resolve(self, name: str) -> Optional[str]:
        """Return existing node ID for `name` (via alias map or fuzzy match)."""
        key = name.lower().strip()

        # 1. Exact alias match
        if key in self._alias_map:
            return self._alias_map[key]

        # 2. Fuzzy match (threshold 88)
        try:
            from rapidfuzz import fuzz
            for alias, node_id in self._alias_map.items():
                if fuzz.token_sort_ratio(key, alias) >= 88:
                    return node_id
        except ImportError:
            pass

        return None

    def _register_aliases(self, node_id: str, name: str, aliases: list[str]) -> None:
        self._alias_map[name.lower().strip()] = node_id
        for alias in aliases:
            if alias:
                self._alias_map[alias.lower().strip()] = node_id

    # ─────────────────────────────────────────────────────────
    # Upsert
    # ─────────────────────────────────────────────────────────

    def upsert_entity(
        self,
        name: str,
        entity_type: str = "concept",
        description: str = "",
        aliases: list[str] | None = None,
        article_title: str = "",
    ) -> str:
        """Add or update an entity node. Returns the node ID."""
        aliases = aliases or []
        existing_id = self._resolve(name)

        if existing_id and self._g.has_node(existing_id):
            node = self._g.nodes[existing_id]
            # Merge aliases
            all_aliases = list(set(node.get("aliases", []) + aliases + [name]))
            node["aliases"] = all_aliases
            node["article_count"] = node.get("article_count", 0) + 1
            if description and not node.get("description"):
                node["description"] = description
            self._register_aliases(existing_id, name, aliases)
            return existing_id

        # New entity
        node_id = _slugify(name)
        # Handle collision
        if self._g.has_node(node_id) and self._g.nodes[node_id].get("name") != name:
            node_id = f"{node_id}-{len(self._g.nodes)}"

        self._g.add_node(
            node_id,
            name=name,
            type=entity_type,
            description=description,
            aliases=[name] + aliases,
            article_count=1,
            articles=[article_title] if article_title else [],
        )
        self._register_aliases(node_id, name, aliases)
        logger.debug("KG: upserted entity '%s' (%s)", name, node_id)
        return node_id

    def upsert_relationship(
        self,
        source_name: str,
        target_name: str,
        rel_type: str,
        context: str = "",
        confidence: float = 0.7,
        article_title: str = "",
    ) -> None:
        src_id = self._resolve(source_name)
        tgt_id = self._resolve(target_name)
        if not src_id or not tgt_id:
            return
        if not self._g.has_node(src_id) or not self._g.has_node(tgt_id):
            return

        # Check for existing edge of same type
        for _, _, data in self._g.out_edges(src_id, data=True):
            pass  # walk — NetworkX MultiDiGraph allows parallel edges

        self._g.add_edge(
            src_id, tgt_id,
            type=rel_type,
            context=context,
            confidence=confidence,
            article=article_title,
        )
        logger.debug("KG: %s -[%s]-> %s", source_name, rel_type, target_name)

    # ─────────────────────────────────────────────────────────
    # Query
    # ─────────────────────────────────────────────────────────

    def get_entity(self, name: str) -> dict | None:
        """Return entity node data + its direct relationships."""
        node_id = self._resolve(name)
        if not node_id or not self._g.has_node(node_id):
            return None

        node = dict(self._g.nodes[node_id])

        # Outgoing relationships
        outgoing = []
        for _, tgt_id, edge_data in self._g.out_edges(node_id, data=True):
            tgt_name = self._g.nodes[tgt_id].get("name", tgt_id)
            outgoing.append({
                "target": tgt_name,
                "type": edge_data.get("type", "related_to"),
                "context": edge_data.get("context", ""),
            })

        # Incoming relationships
        incoming = []
        for src_id, _, edge_data in self._g.in_edges(node_id, data=True):
            src_name = self._g.nodes[src_id].get("name", src_id)
            incoming.append({
                "source": src_name,
                "type": edge_data.get("type", "related_to"),
                "context": edge_data.get("context", ""),
            })

        return {
            **node,
            "id": node_id,
            "outgoing": outgoing[:10],
            "incoming": incoming[:10],
        }

    def get_neighborhood(self, name: str, depth: int = 2) -> dict:
        """All entities within `depth` hops from `name`, sorted by article_count."""
        import networkx as nx

        node_id = self._resolve(name)
        if not node_id or not self._g.has_node(node_id):
            return {"center": name, "neighbors": []}

        # ego_graph on undirected view
        undirected = self._g.to_undirected()
        ego = nx.ego_graph(undirected, node_id, radius=depth)
        ego.remove_node(node_id)  # exclude center itself

        neighbors = []
        for nid in ego.nodes:
            node = dict(self._g.nodes[nid])
            # Get connecting edge info
            edges = []
            for _, _, d in self._g.out_edges(node_id, data=True):
                pass
            neighbors.append({
                "name": node.get("name", nid),
                "type": node.get("type", ""),
                "description": node.get("description", ""),
                "article_count": node.get("article_count", 0),
            })

        neighbors.sort(key=lambda x: x["article_count"], reverse=True)
        return {"center": name, "neighbors": neighbors[:15]}

    def find_path(self, name_a: str, name_b: str, max_depth: int = 4) -> list[str] | None:
        """
        Find shortest path between two entities.
        Returns list of entity names in path order, or None if no path found.
        """
        import networkx as nx

        id_a = self._resolve(name_a)
        id_b = self._resolve(name_b)
        if not id_a or not id_b:
            return None
        if not self._g.has_node(id_a) or not self._g.has_node(id_b):
            return None

        try:
            undirected = self._g.to_undirected()
            path_ids = nx.shortest_path(undirected, id_a, id_b)
            if len(path_ids) > max_depth + 1:
                return None
            return [self._g.nodes[nid].get("name", nid) for nid in path_ids]
        except nx.NetworkXNoPath:
            return None
        except Exception as e:
            logger.warning("Path finding failed: %s", e)
            return None

    def search_entities(self, query: str, n: int = 5) -> list[dict]:
        """Fuzzy search entities by name (for query analysis)."""
        try:
            from rapidfuzz import fuzz, process
            choices = {nid: self._g.nodes[nid].get("name", nid) for nid in self._g.nodes}
            if not choices:
                return []
            matches = process.extract(
                query,
                choices,
                scorer=fuzz.token_sort_ratio,
                limit=n,
            )
            results = []
            for match_name, score, node_id in matches:
                if score < 50:
                    continue
                node = self._g.nodes[node_id]
                results.append({
                    "name": node.get("name", node_id),
                    "type": node.get("type", ""),
                    "description": node.get("description", ""),
                    "score": score,
                })
            return results
        except ImportError:
            # Simple substring fallback
            q = query.lower()
            results = []
            for nid in self._g.nodes:
                name = self._g.nodes[nid].get("name", "")
                if q in name.lower():
                    results.append({"name": name, "type": self._g.nodes[nid].get("type", "")})
            return results[:n]

    @property
    def stats(self) -> dict:
        return {
            "nodes": self._g.number_of_nodes(),
            "edges": self._g.number_of_edges(),
        }


# ─────────────────────────────────────────────────────────────
# Singleton
# ─────────────────────────────────────────────────────────────

_kg_instance: KnowledgeGraph | None = None


def get_graph() -> KnowledgeGraph:
    global _kg_instance
    if _kg_instance is None:
        _kg_instance = KnowledgeGraph()
        logger.info("Knowledge graph initialised (in-memory NetworkX)")
    return _kg_instance
