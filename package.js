Package.describe({
  summary: "Food Crawler",
  name: "food:crawler",
  version: "0.1.0"
});

Npm.depends({
  "soupselect": "0.2.0",
  "htmlparser": "1.7.3",
  "request": "2.16.6",
  "async": "0.2.6",
  "cheerio": "0.12.0"
});

Package.onUse(function(api) {
  api.export('crawler')
  api.addFiles("crawler.js", "server");
});
