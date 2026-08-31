export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /*
     * ========================================
     * API PROXY
     * ========================================
     */

    if (
      url.pathname === "/api" ||
      url.pathname.startsWith("/")
    ) {
      const backendBase = String(
        env.BACKEND_URL || ""
      )
        .trim()
        .replace(/\/+$/, "");

      if (!backendBase) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Backend URL is not configured.",
          }),
          {
            status: 500,
            headers: {
              "Content-Type":
                "application/json; charset=utf-8",
            },
          }
        );
      }

      const backendUrl = new URL(
        `${backendBase}${url.pathname}${url.search}`
      );

      const requestHeaders =
        new Headers(request.headers);

      /*
       * لا نمرر Origin الخاص بالمتصفح إلى Backend.
       * الاتصال هنا Server-to-Server.
       */
      requestHeaders.delete("origin");

      /*
       * لا نمرر Host يدويًا؛ fetch سيستخدم
       * Host الخاص بعنوان Backend.
       */
      requestHeaders.delete("host");

      const proxyRequest = new Request(
        backendUrl.toString(),
        {
          method: request.method,
          headers: requestHeaders,
          body:
            request.method === "GET" ||
            request.method === "HEAD"
              ? undefined
              : request.body,
          redirect: "follow",
        }
      );

      try {
        const response =
          await fetch(proxyRequest);

        const responseHeaders =
          new Headers(response.headers);

        /*
         * الطلب من المتصفح إلى Worker
         * Same-Origin، فلا نحتاج CORS هنا.
         */
        responseHeaders.delete(
          "access-control-allow-origin"
        );
        responseHeaders.delete(
          "access-control-allow-credentials"
        );
        responseHeaders.delete(
          "access-control-allow-methods"
        );
        responseHeaders.delete(
          "access-control-allow-headers"
        );

        return new Response(
          response.body,
          {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
          }
        );
      } catch (error) {
        console.error(
          "Backend proxy error:",
          error
        );

        return new Response(
          JSON.stringify({
            success: false,
            message:
              "تعذر الاتصال بالسيرفر.",
          }),
          {
            status: 502,
            headers: {
              "Content-Type":
                "application/json; charset=utf-8",
            },
          }
        );
      }
    }

    /*
     * ========================================
     * REACT / STATIC ASSETS
     * ========================================
     */

    return env.ASSETS.fetch(request);
  },
};