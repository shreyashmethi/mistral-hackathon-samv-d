import { Outlet } from "react-router";
import { useEffect } from "react";

export function Layout() {
  useEffect(() => {
    // Set body background color to match the app theme
    document.body.style.backgroundColor = "#FFFAEB";
    document.body.style.margin = "0";
    document.body.style.fontFamily = "'Inter', sans-serif";
  }, []);

  return (
    <div className="min-h-screen w-full flex justify-center bg-[#FFFAEB] text-[#000000] font-sans">
      <div className="w-full max-w-[430px] min-h-screen bg-[#FFFAEB] shadow-2xl relative flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
