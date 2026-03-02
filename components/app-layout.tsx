"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  UserCog,
  Settings,
  LogOut,
  Ticket,
  MessageSquare,
  Ship,
  BarChart2,
} from "lucide-react";
import { motion } from "framer-motion";

const navLinks = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <LayoutDashboard className="text-neutral-400 dark:text-neutral-300 size-5 flex-shrink-0" />
    ),
  },
  {
    label: "Tickets",
    href: "/tickets",
    icon: (
      <Ticket className="text-neutral-400 dark:text-neutral-300 size-5 flex-shrink-0" />
    ),
  },
  {
    label: "Chats",
    href: "/chats",
    icon: (
      <MessageSquare className="text-neutral-400 dark:text-neutral-300 size-5 flex-shrink-0" />
    ),
  },
  {
    label: "Profile",
    href: "/profile",
    icon: (
      <UserCog className="text-neutral-400 dark:text-neutral-300 size-5 flex-shrink-0" />
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <Settings className="text-neutral-400 dark:text-neutral-300 size-5 flex-shrink-0" />
    ),
  },
];

const bajajLinks = [
  {
    label: "Bajaj Board",
    href: "/bajaj/boards/vipar",
    icon: (
      <Ship className="text-amber-500 size-5 flex-shrink-0" />
    ),
  },
  {
    label: "Bajaj Analytics",
    href: "/bajaj/dashboard",
    icon: (
      <BarChart2 className="text-amber-500 size-5 flex-shrink-0" />
    ),
  },
];

function LogoutButton() {
  const { open, animate } = useSidebar();
  const router = useRouter();

  async function handleLogout() {
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center justify-start gap-2 group/sidebar py-2 w-full text-left"
    >
      <LogOut className="text-neutral-400 dark:text-neutral-300 size-5 flex-shrink-0" />
      <motion.span
        animate={{
          display: animate
            ? open
              ? "inline-block"
              : "none"
            : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-neutral-400 dark:text-neutral-300 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
      >
        Logout
      </motion.span>
    </button>
  );
}

function SidebarBottom() {
  const { open, animate } = useSidebar();
  const showLabel = animate ? open : true;

  return (
    <div className="flex flex-col items-center gap-2 pt-4 border-t border-neutral-700">
      <Link
        href="/"
        className="flex flex-col items-center gap-1.5 group"
        aria-label="Home"
      >
        {/* Circular logo */}
        <div className="size-10 rounded-full overflow-hidden bg-white ring-2 ring-neutral-700 group-hover:ring-violet-500 transition-all flex-shrink-0">
          <Image
            src="/logo.png"
            alt="Manilal logo"
            width={40}
            height={40}
            className="size-full object-contain"
          />
        </div>

        {/* Label + copyright — only shown when expanded */}
        {showLabel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center text-center"
          >
            <span className="text-sm font-medium text-neutral-200">
              Manilal
            </span>
            <span className="text-[10px] text-neutral-600 leading-tight">
              © 2026 Manilal. All rights reserved.
            </span>
          </motion.div>
        )}
      </Link>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-dvh bg-neutral-900 text-neutral-50">
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-4 border-r border-neutral-700">
          {/* Top — nav links */}
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden gap-2 pt-2">
            {navLinks.map((link, idx) => (
              <SidebarLink key={idx} link={link} href={link.href} />
            ))}

            {/* Bajaj module section */}
            <div className="my-1 border-t border-neutral-800 pt-2">
              {bajajLinks.map((link, idx) => (
                <SidebarLink key={`bajaj-${idx}`} link={link} href={link.href} />
              ))}
            </div>

            <div className="mt-2">
              <LogoutButton />
            </div>
          </div>

          {/* Bottom — logo + copyright */}
          <SidebarBottom />
        </SidebarBody>
      </Sidebar>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
