"use client";
import { getToken, clearAllStorage } from "@/lib/session";
import {
  Bell,
  Search,
  User,
  BookOpen,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logoutUser } from "@/apiServices/tokenVerify";
import { postLogout } from "@/app/lms/pages/logs/api/activityLog";
import { toast } from "sonner";

export function Navbarpro() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const token = getToken();
      if (!token) {
        clearAllStorage();
        toast.info("Logged out successfully");
        router.push("/login");
        return;
      }
      // Record logout time / session duration while the token is still present.
      await postLogout();
      const response = await logoutUser(token);
      clearAllStorage();
      toast.success(response.message?.[0]?.value || "Logged out successfully");
      router.push("/login");
    } catch (error: any) {
      console.error("Logout error:", error);
      clearAllStorage();
      if (error.response?.data?.message) {
        toast.error(error.response.data.message[0]?.value || "Logout failed");
      } else if (error.message) {
        toast.error("Network error during logout");
      } else {
        toast.error("Logout failed");
      }
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navbarTextStyle = {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    fontStyle: "normal" as const,
    fontWeight: 400,
    color: "rgb(80, 82, 88)",
    fontSize: "13px",
    lineHeight: "normal" as const,
  };

  const logoTextStyle = {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    fontStyle: "normal" as const,
    fontWeight: 600,
    color: "rgb(80, 82, 88)",
    fontSize: "14px",
    lineHeight: "normal" as const,
  };

  return (
    <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 relative">
      {/* Left side - Logo and Navigation */}
      <div className="flex items-center gap-6 relative z-10">
        {/* Logo Section */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-sm flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span style={logoTextStyle} className="text-gray-800 hidden sm:block">
            Learning Hub
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="hidden md:flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 rounded-sm hover:bg-gray-100 transition-colors"
          >
            <span style={navbarTextStyle}>Teams</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 rounded-sm hover:bg-gray-100 transition-colors"
          >
            <span style={navbarTextStyle}>Apps</span>
          </Button>
        </nav>
      </div>

      {/* Center - Search Bar */}
      <div className="hidden lg:flex items-center flex-1 max-w-md mx-8 relative z-10">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses, topics..."
            style={navbarTextStyle}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 placeholder-gray-500"
          />
        </div>
      </div>

      {/* Right side - Actions and user menu */}
      <div className="flex items-center gap-2 relative z-10">
        {/* Create Button */}

        {/* Mobile search */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden h-8 w-8 rounded-sm hover:bg-gray-100 transition-colors text-gray-600"
        >
          <Search className="w-4 h-4" />
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="sm"
          className="relative h-8 w-8 rounded-sm hover:bg-gray-100 transition-colors text-gray-600"
        >
          <Bell className="w-4 h-4" />
          <Badge className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-xs bg-red-500 text-white border-0 rounded-full">
            3
          </Badge>
        </Button>

        {/* Help */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-sm hover:bg-gray-100 transition-colors text-gray-600"
        >
          <HelpCircle className="w-4 h-4" />
        </Button>

        {/* Settings */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-sm hover:bg-gray-100 transition-colors text-gray-600"
        >
          <Settings className="w-4 h-4" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-sm hover:bg-gray-100 transition-colors p-0"
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src="/avatar.jpg" alt="User" />
                <AvatarFallback className="bg-blue-600 text-white font-semibold text-xs">
                  JD
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 bg-white border border-gray-200 shadow-lg rounded-sm p-2"
            align="end"
            forceMount
          >
            <DropdownMenuLabel className="font-normal p-0 mb-2">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-sm">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="/avatar.jpg" alt="User" />
                  <AvatarFallback className="bg-blue-600 text-white font-semibold">
                    JD
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p
                    style={{ ...navbarTextStyle, fontWeight: 600 }}
                    className="text-gray-900"
                  >
                    John Doe
                  </p>
                  <p
                    style={{ ...navbarTextStyle, fontSize: "12px" }}
                    className="text-gray-600"
                  >
                    john.doe@example.com
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span
                      style={{ ...navbarTextStyle, fontSize: "12px" }}
                      className="text-green-600"
                    >
                      Online
                    </span>
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuItem className="flex items-center gap-3 p-2 rounded-sm hover:bg-gray-50 transition-colors cursor-pointer">
              <User className="w-4 h-4 text-gray-600" />
              <span style={navbarTextStyle} className="text-gray-700">
                Profile
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem className="flex items-center gap-3 p-2 rounded-sm hover:bg-gray-50 transition-colors cursor-pointer">
              <Settings className="w-4 h-4 text-gray-600" />
              <span style={navbarTextStyle} className="text-gray-700">
                Settings
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem className="flex items-center gap-3 p-2 rounded-sm hover:bg-gray-50 transition-colors cursor-pointer">
              <HelpCircle className="w-4 h-4 text-gray-600" />
              <span style={navbarTextStyle} className="text-gray-700">
                Help & Support
              </span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-gray-200" />

            <DropdownMenuItem
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {" "}
              <LogOut className="w-4 h-4 text-gray-600" />
              <span style={navbarTextStyle} className="text-gray-700">
                Sign Out
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
