import React from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineShoppingCart } from "react-icons/hi";
import { FaUserCircle } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerClose,
} from "@/components/ui/drawer";
import { Menu } from "lucide-react";

export default function Header({ isLoggedIn = true }) {
  const { t: headerTranslate } = useTranslation("headerFlow");

  return (
    <header className="bg-[#ffefd1] sticky top-0 z-50 shadow-md px-6 py-2 flex justify-between items-center">
      {/* Lado izquierdo para móviles */}
      <div className="md:hidden">
        <Drawer direction="left">
          <DrawerTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="text-[#975023] w-6 h-6" strokeWidth={4} />
            </Button>
          </DrawerTrigger>

          <DrawerContent className="fixed inset-0 z-[100] w-[320px] bg-[#fdf8ee] shadow-lg flex flex-col items-center space-y-6 pt-0 rounded-none border-none [&>div:first-child]:bg-[#975023]">
            {/* Opciones del menú */}
            <div className="flex flex-col w-full px-4 space-y-2">
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  className="justify-start w-full text-[#975023] text-lg"
                >
                  {headerTranslate("home")}
                </Button>
              </DrawerClose>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  className="justify-start w-full text-[#975023] text-lg"
                >
                  {headerTranslate("payments")}
                </Button>
              </DrawerClose>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  className="justify-start w-full text-[#975023] text-lg"
                >
                  {headerTranslate("shipping")}
                </Button>
              </DrawerClose>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Logo centrado en móviles y a la izquierda en desktop */}
      <div className="flex-grow flex justify-center md:justify-start">
        <img
          src="/dropping-logo-text.png"
          alt="Dropping Logo"
          className="h-20 w-auto"
        />
      </div>

      {/* Opciones visibles en desktop */}
      <div className="hidden md:flex items-center space-x-4">
        <Button variant="ghost">{headerTranslate("home")}</Button>
        <Button variant="ghost">{headerTranslate("payments")}</Button>
        <Button variant="ghost">{headerTranslate("shipping")}</Button>
      </div>

      {/* Lado derecho, común */}
      <div className="flex items-center space-x-3">
        <button
          className="text-[#975023] text-2xl hover:scale-110 transition-transform duration-200"
          title={headerTranslate("cart")}
        >
          <HiOutlineShoppingCart />
        </button>

        {isLoggedIn ? (
          <button
            className="text-[#975023] text-2xl hover:scale-110 transition-transform duration-200"
            title="Perfil"
          >
            <FaUserCircle />
          </button>
        ) : (
          <>
            <button className="config-button-primary">
              {headerTranslate("login")}
            </button>
            <button className="config-button-secondary">
              {headerTranslate("register")}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
