export const environment = {
  /**
   * The site is served by Vercel, which forwards /api and /uploads to the API on Render but cannot proxy
   * WebSockets, so the SignalR hub connects to Render directly.
   */
  hubOrigin: 'https://fresh-n-healthy-api.onrender.com',
};
