const localStack = typeof location !== "undefined"
  && ["localhost", "127.0.0.1"].includes(location.hostname);

window.APP_CONFIG = {
  supabaseUrl: localStack
    ? "http://127.0.0.1:54321"
    : "https://klxcwkclydirdxomkbtv.supabase.co",
  supabaseAnonKey: localStack
    ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    : "sb_publishable_aq6I7utQf3EaDOhpABbO_Q_E23oyrI2",
  idadeMinima: 21,
  motivacaoMin: 100,
  motivacaoMax: 2000,
  lgpdVersao: "2026-08-17",
  maxDocMb: 5,
};
