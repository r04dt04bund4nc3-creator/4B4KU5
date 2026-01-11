function CheckIcon() {
  return (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
                    d="M7.8 10.7l-1.6-1.6-1.2 1.2 2.8 2.8L15.2 5.7 14 4.5 7.8 10.7z"
                            fill="currentColor"
                                  />
                                      </svg>
                                        );
                                        }

                                        export function Header() {
                                          return (
                                              <header className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-6">
                                                    <div className="cyber-panel px-5 py-4">
                                                            <div className="flex items-center justify-between gap-4">
                                                                      <div className="flex items-center gap-4">
                                                                                  <div className="text-3xl sm:text-4xl cyber-logo">4B4KU5</div>

                                                                                              <nav className="hidden md:flex items-center gap-4 text-white/65">
                                                                                                            {["Controls", "Layers", "FX", "Sequence", "Pads", "Mixer"].map((t) => (
                                                                                                                            <a
                                                                                                                                              key={t}
                                                                                                                                                                className="text-xs cyber-text hover:text-white transition"
                                                                                                                                                                                  href="#"
                                                                                                                                                                                                    onClick={(e) => e.preventDefault()}
                                                                                                                                                                                                                    >
                                                                                                                                                                                                                                      {t}
                                                                                                                                                                                                                                                      </a>
                                                                                                                                                                                                                                                                    ))}
                                                                                                                                                                                                                                                                                </nav>
                                                                                                                                                                                                                                                                                          </div>

                                                                                                                                                                                                                                                                                                    <div className="flex items-center gap-3">
                                                                                                                                                                                                                                                                                                                <div className="pill px-3 py-2 text-[11px] cyber-text text-[#FDE047] flex items-center gap-2">
                                                                                                                                                                                                                                                                                                                              <CheckIcon />
                                                                                                                                                                                                                                                                                                                                            Premium Subscription Active
                                                                                                                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                                                                                                                                          </div>

                                                                                                                                                                                                                                                                                                                                                                                  <div className="mt-4 cyber-divider" />
                                                                                                                                                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                                                                                                                                                            </header>
                                                                                                                                                                                                                                                                                                                                                                                              );
                                                                                                                                                                                                                                                                                                                                                                                              }