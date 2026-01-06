const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

function serve(res, file, type = "text/html") {
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("404 Not Found");
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

http.createServer((req, res) => {
  let url = req.url === "/" ? "/SE.html" : req.url;
  let filePath = path.join(ROOT, url);

  const ext = path.extname(filePath);
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp"
  };

  serve(res, filePath, types[ext] || "application/octet-stream");
}).listen(PORT, () => {
  console.log("HYPINEX CORE running on port", PORT);
});
