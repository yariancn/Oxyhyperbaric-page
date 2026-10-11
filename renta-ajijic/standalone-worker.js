import { handleRentaAjijicApi } from "./worker-search.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/renta-ajijic" || url.pathname === "/api/renta-ajijic/") {
      return handleRentaAjijicApi(request);
    }
    return env.ASSETS.fetch(request);
  },
};
