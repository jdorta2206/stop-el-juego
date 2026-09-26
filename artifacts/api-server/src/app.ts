    res.type("text/plain");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send("google.com, pub-4807272408824742, DIRECT, f08c47fec0942fa0\\n");
  });

  app.get("/.well-known/assetlinks.json", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(path.join(clientDist, ".well-known", "assetlinks.json"), { dotfiles: "allow" }, (err) => {
      if (!err) return;
      if (!res.headersSent) {
        res.status(404).json({ error: "assetlinks.json not found" });
      }
    });
  });
  app.use(express.static(clientDist, {
    dotfiles: "allow",
    index: false,