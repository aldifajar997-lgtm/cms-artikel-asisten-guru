export async function verifyTurnstile(
  token: string,
  secret: string,
  expectedAction: string,
  expectedHostnamesString: string,
  clientIp?: string
): Promise<boolean> {
  const expectedHostnames = new Set(
    (expectedHostnamesString || "")
      .split(",")
      .map((hostname) => hostname.trim())
      .filter(Boolean)
  );

  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > 2048 ||
    expectedHostnames.size === 0
  ) {
    return false;
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);
    if (clientIp) {
      params.append('remoteip', clientIp);
    }

    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(10_000)
    });

    if (!r.ok) {
      console.error(`Turnstile siteverify failed: ${r.status}`);
      return false;
    }
    
    const result: any = await r.json();
    
    if (
      !result.success ||
      result.action !== expectedAction ||
      !expectedHostnames.has(result.hostname)
    ) {
      console.warn("Turnstile validation failed:", result);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error("Turnstile fetch error:", err);
    return false;
  }
}
