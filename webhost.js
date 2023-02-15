// node modules
const fs = require('fs');
var showdown  = require('showdown')
converter = new showdown.Converter()
var syncreq = require('sync-request');
var http = require('http');
var localpath = process.argv[2];
if (typeof localpath == "undefined") {localpath = './'}
const port = 8013

// Get some globals set up so we can reset them with a HUP
var webhost = ""
var uxapihost = ""
var configkeys = {}
var clientID = ""
var clientSecret = ""
var reservedwords = []
var contract = {}
var siteName = ''
var pageName = ''
var pageBlurb = ''
var pageImage = ''
var pagemenu = ''

// Site config varialbes
var template = []

initialize()

console.log("listening on http://localhost:" + port)
var server = http.createServer(function (req, res) {
  header = template[0]
  footer = template[1]

  var pageURL = webhost + req.url
  header = header.replace(/fSITENAME/g, siteName)
  header = header.replace(/fPAGEURL/g, pageURL)


  var data = ""
  var verb = req.method;
  var queryparams = req.url.split('?')[1]
  var qp = {}
  if (typeof(queryparams) != 'undefined') {
    var queryparams = queryparams.split('&')
    for (var i = 0; i < queryparams.length; i++) {
      var tmp = queryparams[i].split('=')
      qp[tmp[0]] = tmp[1]
    }
  }
  var path = req.url.split('?')[0];
  if (path.slice(-1) == `/`) (path = path.slice(0, -1))
  var pathels = path.split('/')

  // Assign a content type based on ext
  var tmp = path.split('.')
  var ext = (tmp[tmp.length -1])
  var contentType = "text/plain"
  if (ext == "html") {contentType = "text/html"}
  if (ext == "js") {contentType = "text/javascript"}
  if (ext == "json") {contentType = "application/json"}
  if (ext == "png") {contentType = "image/png"}
  if (ext == "gif") {contentType = "image/gif"}
  if (ext == "jpg") {contentType = "image/jpeg"}
  if (ext == "jpeg") {contentType = "image/jpeg"}
  if (ext == "css") {contentType = "text/css"}
  if (ext == "ico") {contentType = "image/x-icon"}
  if (ext == "eot") {contentType = "text/plain"}
  if (ext == "svg") {contentType = "text/plain"}
  if (ext == "ttf") {contentType = "text/plain"}
  if (ext == "map") {contentType = "text/plain"}
  if (ext == "woff") {contentType = "text/plain"}
  if (ext == "rss") {contentType = "application/rss+xml"}

  // reinitializ
  if (pathels[1] == 'HUP') {
    initialize()
    msg = '<h1>Reinitialized</h1>'
    header = header.replace(/xTITLEx/g, 'Reinitialize Site Details')
    header = header.replace(/xPAGEIMAGEx/g, '')
    header = header.replace(/xPAGEBLURBx/g, '')

        header = header.replace(/xPAGESMENUx/g, pagemenu)
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(header + msg + footer); // Send the file data to the browser.
    return;
  }

  // Return images from the API image library
  if (pathels[1] == 'images' && pathels[2] == 'library') {
    var imgresp = {}
    var respayload = ""
    try {
      var objectID = pathels[3].split('.')[0]
      imgresp = syncreq('GET', uxapihost + "/v1/pages/" + objectID, {})
      imgresp = JSON.parse(imgresp.body.toString())
      if (typeof(imgresp.error) == 'undefined') {
        var obj = JSON.parse(JSON.stringify(imgresp))
        if (typeof(obj.object) != 'undefined') {
          if (typeof(obj.object.socialimage) != 'undefined') {
            let text = obj.object.socialimage.split(`,`)
            if (text[0].substring(0,5) == 'data:') {
              conentType=text[0].split(':')[1]
              // let buff = new Buffer(text, 'base64');
              let buff = Buffer.from(text[1], "base64");
              respayload = buff
            }
            else {
              contentType = "image/gif"
              resppayload = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAQAIBRAA7";
            }
          }
        }
      }
    }catch (err){console.log(err)}
    res.writeHead(200, {'Content-Type': contentType});
    res.end(respayload); // Send the file data to the browser.
    return;
  }

  // redirect to index.html on `/`
  if (path == '/' || path == '') {
    path = '/index.html'; contentType="text/html"
    var articles = syncreq('GET', uxapihost + '/v1/categories?menuname=home', {})
    articles = JSON.parse(articles.body.toString())
    try {
      pageName = articles.object.menuname
    }catch {pageName = "Error";}

    if (typeof(articles.objects) != 'undefined') {
      if (typeof(articles.objects[0].object) != 'undefined') {
        msg = renderCats(articles, path)

        res.writeHead(200, {'Content-Type': contentType});
        res.end(msg); // Send the file data to the browser.
        return;

      }
    }
    else {
      msg = `
        <h2>Sorry...</h2>
        <p>It looks like the page <I>` + pathels[1] + `</I> doesn't exist</p>
      `
    }

      header = header.replace(/xPAGENAMEx/g, '')
      header = header.replace(/xPAGEIMAGEx/g, '')
      header = header.replace(/xPAGEBLURBx/g, '')

            header = header.replace(/xPAGESMENUx/g, pagemenu)
      res.writeHead(200, {'Content-Type': contentType});
      res.end(header + msg + footer); // Send the file data to the browser.
      return;
  }

  // redirect to /admin/index.html on `/dashboard`
  if (path == '/admin' || path == '/admin/') {path = '/admin/index.html'; contentType="text/html"}

  if (typeof(pathels[1]) != 'undefined' && typeof(pathels[2]) == 'undefined') {
    if (reservedwords.includes(pathels[1]) == true ) {}
    else {
      contentType = "text/html"
      pathels[1] = decodeURIComponent(pathels[1].replace(/-/g, ' '))
      var msg = ''
      var articles = syncreq('GET', uxapihost + '/v1/categories?menuname=' + pathels[1], {})
      articles = JSON.parse(articles.body.toString())
      try {
        pageName = articles.object.menuname
      }catch {pageName = "Error";}
      if (typeof(articles.objects) != 'undefined') {
        if (typeof(articles.objects[0].object) != 'undefined') {
          msg = renderCats(articles, path)
          res.writeHead(200, {'Content-Type': contentType});
          res.end(msg);
          return;

        }
      }
      else {
        msg = `
          <h2>Sorry...</h2>
          <p>It looks like the page <I>` + pathels[1] + `</I> doesn't exist</p>
        `
        header = header.replace(/fPAGENAME/g, '')
        header = header.replace(/fPAGEIMAGE/g, pageImage)
        header = header.replace(/fPAGEBLURB/g, '')

                header = header.replace(/xPAGESMENUx/g, pagemenu)

        res.writeHead(404, {'Content-Type': contentType});
        res.end(header + msg + footer); // Send the file data to the browser.
        return;
      }
    }
  }

  if (typeof(pathels[1]) != 'undefined' && typeof(pathels[2]) != 'undefined') {
    if (reservedwords.includes(pathels[1]) == true ) {}
    else {
      contentType = "text/html"
      pathels[1] = decodeURIComponent(pathels[1].replace(/-/g, ' '))
      var msg = ''
      var articles = syncreq('GET', uxapihost + '/v1/categories?menuname=' + pathels[1], {})
      articles = JSON.parse(articles.body.toString())
      try {
        pageName = articles.object.menuname
      }catch {pageName = "Error";}
      if (typeof(articles.objects) != 'undefined') {
        if (typeof(articles.objects[0].object) != 'undefined') {
          msg = renderPages(articles, path)
          res.writeHead(200, {'Content-Type': contentType});
          res.end(msg);
          return;

        }
      }
      else {
        msg = `
          <h2>Sorry...</h2>
          <p>It looks like the page <I>` + pathels[1] + `</I> doesn't exist</p>
        `
        header = header.replace(/fPAGENAME/g, '')
        header = header.replace(/fPAGEIMAGE/g, pageImage)
        header = header.replace(/fPAGEBLURB/g, '')

                header = header.replace(/xPAGESMENUx/g, pagemenu)

        res.writeHead(404, {'Content-Type': contentType});
        res.end(header + msg + footer); // Send the file data to the browser.
        return;
      }
    }
  }


  try {
    var stats = fs.statSync(localpath + 'website' + path)
    if (stats.isDirectory() == true) {
      res.writeHead(403, {'Content-Type': 'text/html'})

      header = header.replace(/fPAGENAME/g, 'Error')
      header = header.replace(/fPAGEIMAGE/g, pageImage)
      header = header.replace(/fPAGEBLURB/g, '')

            header = header.replace(/xPAGESMENUx/g, pagemenu)


      res.end(header + '<h1>403: Directory listing not allowed</h1><p>Sorry, this is a directory without an index</p>' + footer)
      return
    }
  }catch {
    res.writeHead(404, {'Content-Type': 'text/html'})

    header = header.replace(/fPAGENAME/g, 'Error Not Found')
    header = header.replace(/fPAGEIMAGE/g, pageImage)
    header = header.replace(/fPAGEBLURB/g, '')

        header = header.replace(/xPAGESMENUx/g, pagemenu)

    res.end(header + `<h1>404: Not Found</h1><p>Sorry, we weren't able to find the page you're looking for</p><p>` + verb + " " + path + "</p>" + footer)
    return
  }
  fs.readFile(localpath + 'website' + path, function(err, data) {
        if (err) throw err
        if (contentType == 'text/html') {

          header = header.replace(/fPAGENAME/g, pageName)
          header = header.replace(/fPAGEIMAGE/g, pageImage)
          header = header.replace(/fPAGEBLURB/g, '')

          footer = template[1]
                    header = header.replace(/xPAGESMENUx/g, pagemenu)

          res.writeHead(200, {'Content-Type': contentType});
          res.end(header + data + footer); // Send the file data to the browser.
          return
        }
        else {
          res.writeHead(200, {'Content-Type': contentType});
          res.end(data); // Send the file data to the browser.
        }
  });
}).listen(port);


function pageMenu(page, size) {
  if (typeof(page) == 'undefined') { page =0 }
  if (typeof(size) == 'undefined') { size =50 }
  var msg = ""
  var pages = syncreq('GET', uxapihost + '/v1/categories?sortBy=rank&offSet=1', {})
  pages = JSON.parse(pages.body.toString())
  if (typeof(pages.objects) != 'undefined') {
    for (var i =0; i < pages.objects.length; i++) {
      msg = msg + `<li><A href="/`  + encodeURIComponent(pages.objects[i].object.menuname.replace(/\ /g, '-')) + `">` + pages.objects[i].object.menuname + `</a></li>`
    }
  }
  pagemenu = msg
  return msg;
}

function renderCats(articles, path) {
  msg = ""
  articles = articles.objects[0]
  var path = uxapihost + '/v1/templates?templatesname=' + articles.object.template
  var pagestemplate = syncreq('GET', path, {})
  pagestemplate = JSON.parse(pagestemplate.body.toString())
  try {
    pagestemplate = template[0] + pagestemplate.objects[0].object.categorytemplate + template[1]
  }catch {pagestemplate = template[0] + defaultCategoryHTML + template[1]}
  var d = new Date(articles.created);
  articles.created = d.setUTCSeconds(articles.created);
  converter = new showdown.Converter(),
  text      = articles.object.content,
  articles.object.content      = converter.makeHtml(text);
  articles.object.blurb = articles.object.blurb.replace(/\n/g, " ")
  msg = msg + "<div class=markdown>" + articles.object.content + "</div>"

  for (const [key, value] of Object.entries(articles.object)) {
    var regx = new RegExp('x'+key.toUpperCase()+'x', 'g')
    pagestemplate = pagestemplate.replace(regx, articles.object[key])
  }
  pagestemplate = pagestemplate.replace(/xOBJECTIDx/, articles.objectID)
  pagestemplate = pagestemplate.replace(/xPAGEURLx/g, webhost + path)
  pagestemplate = pagestemplate.replace(/xPAGESMENUx/g, pagemenu)
  msg = pagestemplate
  return msg
}

function renderPages(articles, path) {
  var msg = ""; var err = ""
  var pathels = path.split('/')
  articles = articles.objects[0]
  var path = uxapihost + '/v1/templates?templatesname=' + articles.object.template
  var pagestemplate = syncreq('GET', path, {})
  pagestemplate = JSON.parse(pagestemplate.body.toString())
  try {
    pagestemplate = template[0] + pagestemplate.objects[0].object.template + template[1]
  }catch {pagestemplate = template[0] + defaultArticleHTML + template[1]}
  path = uxapihost + '/v1/categories/' + articles.objectID + '/articles/' + pathels[2]
  articles = syncreq('GET', path, {})
  try {
    articles = JSON.parse(articles.body.toString())
  }catch {
    err = "error"
  }

  if (typeof(articles.object) == 'undefined' || err == "error") {
    msg = `
      <h2>Sorry...</h2>
      <p>It looks like the page doesn't exist</p>
    `
    var header = template[0]; footer = template[1]
    header = header.replace(/xTITLEx/g, 'Error')
    header = header.replace(/xPAGEIMAGEx/g, '')
    header = header.replace(/xPAGEBLURBx/g, '')

        header = header.replace(/xPAGESMENUx/g, pagemenu)
    return header + msg + footer;
  }
  else {
    var d = new Date(articles.created);
    articles.created = d.setUTCSeconds(articles.created);
    converter = new showdown.Converter(),
    text      = articles.object.content,
    articles.object.content      = converter.makeHtml(text);
    articles.object.blurb = articles.object.blurb.replace(/\n/g, " ")
    msg = msg + "<div class=markdown>" + articles.object.content + "</div>"

    for (const [key, value] of Object.entries(articles.object)) {
      var regx = new RegExp('x'+key.toUpperCase()+'x', 'g')
      pagestemplate = pagestemplate.replace(regx, articles.object[key])
    }
    pagestemplate = pagestemplate.replace(/xOBJECTIDx/, articles.objectID)
    pagestemplate = pagestemplate.replace(/xPAGEURLx/g, webhost + path)
    pagestemplate = pagestemplate.replace(/xPAGESMENUx/g, pagemenu)
    msg = pagestemplate
    return msg
  }
}

function initialize() {
  webhost = "https://michaelbissell.com"
  uxapihost = "https://api.catherineweaver.uxapi.io"
  configkeys = syncreq('GET', uxapihost + "/tmp", {})
  configkeys = JSON.parse(configkeys.body.toString())
  clientID = configkeys.object.id
  clientSecret = configkeys.object.secret

  reservedwords = []

  fs.readdir('./website', (err, files) => {
    files.forEach(file => {
      reservedwords.push(file)
    });
  });


 contract = syncreq('GET', uxapihost, {})
  contract = JSON.parse(contract.body.toString())

  siteName = contract.info.title
  pageName = ''
  pageBlurb = ''
  pageImage = '/images/bissellator.jpeg'


  // Site config varialbes
  template = []
  try {
    var tmp = fs.readFileSync( localpath + '/objects/template.html' )
    tmp = tmp.toString()
    tmp = tmp.replace(/xSITENAMEx/g, siteName)
    template = tmp.split('<!--	uxapitemplate -->')
  }catch(err) {console.log(err); template[0] = ""; template[1]=""}
  if (typeof(template[1]) == 'undefined') {
    template[0] = ""; template[1]=""
  }
  pageMenu()
}

var defaultCategoryHTML = `
<div style="overflow:auto">
  <img src="xSOCIALIMAGEx" style="width:30%; float:right">
  <h1>xTITLEx</h1>
  <div>xCONTENTx</div>
</div>
  <script>
      var tmp = ( listObjects('/v1/categories/xOBJECTIDx/articles', {
        title: "title",
        blurb: "blurb",
        img: 'socialimage',
        link: '/xMENUNAMEx/{objectID}/{title}'
       }, 'tiles')
     )
     if (tmp != 'resource not found') { document.write(tmp)}
  </script>
`

var defaultArticleHTML = `
  <img src="xSOCIALIMAGEx" style="width:30%; float:right">
  <h1>xTITLEx</h1>
  <div>xCONTENTx</div>
`
