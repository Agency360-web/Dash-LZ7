import { Outlet } from "react-router-dom";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function SidebarCustomTrigger() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn(
        "fixed z-50 h-6 w-6 rounded-full border bg-background text-emerald-600 shadow-md transition-all duration-200 ease-linear hover:bg-accent hover:text-emerald-700",
        collapsed ? "left-[calc(var(--sidebar-width-icon)-12px)]" : "left-[calc(var(--sidebar-width)-12px)]",
        "top-4"
      )}
      onClick={toggleSidebar}
    >
      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
    </Button>
  );
}

export default function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarCustomTrigger />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-background">
        <header className="h-14 flex items-center gap-3 border-b border-border bg-card px-4 sticky top-0 z-10">
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-x-auto">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}