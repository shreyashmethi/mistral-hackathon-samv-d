import { createBrowserRouter } from "react-router";
import { Layout } from "./layout/Layout";
import { ConversationScreen } from "./pages/ConversationScreen";
import { ArticleModeScreen } from "./pages/ArticleModeScreen";
import { SettingsScreen } from "./pages/SettingsScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: ConversationScreen },
      { path: "article", Component: ArticleModeScreen },
      { path: "settings", Component: SettingsScreen },
    ],
  },
]);
