import React from "react";
import { Header } from "./Header";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
      <div className="cyber-bg text-white">
            <div className="relative z-10">
                    <Header />
                            <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-16">
                                      {children}
                                              </main>
                                                    </div>
                                                        </div>
                                                          );
                                                          }