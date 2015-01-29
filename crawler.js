var htmlparser = Npm.require('htmlparser'),
  request = Npm.require('request'),
  select = Npm.require('soupselect').select,
  cheerio = Npm.require('cheerio'),
  async = Npm.require('async'),
  url = Npm.require('url');

crawler = {

  /**
   * Parse Rollhouse
   */
  rollhouse: function(callback) {
    var parseRollhousePage = function($, callback) {
      var result = [];

      $('.relative').each(function(i, item) {
        var $item = $(item)
        if (!$item.find('.name').length) return

        var title = $item.find('.name').text(),
          price = parseFloat($item.find('.weight b').text())

        result.push({
          title: title,
          price: price
        })
      });

      callback(null, result);
    }

    var parallelJobs = [],
      categories = ['rolls', 'sushi', 'sashimi', 'hot', 'salad', 'soup', 'desert', 'drink'];

    categories.forEach(function(category) {
      parallelJobs.push(function(callback) {
        reqCheerio('http://rollhouse.ua/products/' + category + '/', parseRollhousePage, function(err, items) {
          var type;
          switch (category) {
            case 'soup':
              type = 'first'
              break
            case 'hot':
              type = 'second'
              break
            case 'drink':
            case 'desert':
            case 'salad':
              type = 'third'
              break
            default:
              type = 'first-second'
          }
          callback(err, {
            title: ucfirst(category),
            type: type,
            items: items
          });
        });
      });
    });

    async.parallel(parallelJobs, function(err, result) {
      if (err) return callback(err);
      // Result JSON
      callback(null, {
        title: 'Rollhouse',
        name: 'rollhouse',
        href: 'http://www.rollhouse.com.ua/',
        menu: result,
        tags: [
          "ролхаус",
          "rollhouse"
        ]
      });
    });
  },

  /**
   * Parse Gudbagel
   */
  gudbagel: function(callback) {
    req('http://gudbagel.com/order.php', function(dom, callback) {
      var items = [];

      select(dom, '#order_form td[valign=middle]').forEach(function(td) {
        var imageSrc = selectAttr(td, 'img', 'src'),
          input = select(td, 'input.pricecalc');
        if (!imageSrc || !input) return;
        var nameMatch = attr(input, 'name').match(/^price_(.+)$/),
          name = nameMatch[1] || null;
        if (!name) return;
        var price = parseInt(attr(input, 'value'));
        items.push({
          title: ucfirst(name),
          description: null,
          price: price,
          image: imageSrc
        });
      });

      callback(null, items);

    }, function(err, items) {
      if (err) return callback(err);
      callback(null, {
        title: 'Gudbagel',
        name: 'gudbagel',
        href: 'http://gudbagel.com/',
        menu: [
          {
            title: '',
            type: 'first-second',
            items: items
          }
        ]
      });
    });
  },

  /**
   * Parse Takibox
   */
  takibox: function(callback) {

    var menu = [];

    var parseTakiboxPage = function(category, type) {
      return function(dom, callback) {
        var items = [];

        select(dom, '.browseProductContainer').forEach(function(product) {
          var boxMatch = selectText(product, 'a.title').match(/(\d+)/),
            number = boxMatch && parseInt(boxMatch[1]),
            title = selectText(product, 'a.title span'),
            description = selectText(product, '.description em'),
            weightMatch = selectText(product, '.description strong').match(/Вес[^\d]*(\d+)/),
            weight = weightMatch && parseInt(weightMatch[1]),
            imageSrc = selectAttr(product, 'img', 'src').replace(/&amp;/g, '&'),
            price = parseFloat(selectText(product, '.productPrice'));
          if (!number) {
            var match = title.match(/^[^\w\d]*(\d+)[^а-яa-z\d]*([а-яa-z].+)$/i);
            if (!match) return;
            number = match[1];
            title = match[2];
          }
          title = title.replace(/\s+/g, ' ');

          items.push({
            title: number + ' ' + title,
            description: description,
            weight: weight,
            image: imageSrc,
            price: price
          })
        });

        menu.push({
          title: category,
          type: type,
          items: items
        });

        callback();
      };
    };

    async.series([
      function(callback) {
        req('http://www.taki-box.com/', parseTakiboxPage('Boxes', 'first-second'), callback);
      },
      function(callback) {
        req('http://www.taki-box.com/Zakuski', parseTakiboxPage('Salads', 'third'), callback);
      }
    ], function(err) {
      if (err) return callback(err);
      callback(null, {
        title: 'Taki-box',
        name: 'takibox',
        href: 'http://www.taki-box.com/',
        menu: menu
      });
    });
  },

  /**
   * Parse Ecobuffet
   */
  ecobuffet: function(callback) {

    var days = []

    var parseEcobuffetPage = function(dom, callback) {
      var items

      select(dom, 'table.mceItemTable tr').forEach(function(row) {
        var dayText = selectText(row, 'td u').trim()

        if (dayText) {
          days.push({
            menu: [
              {
                title: "",
                type: 'first-second',
                items: items = []
              }
            ]
          })
        }

        var title = selectText(select(row, 'td')[1], 'b')
        if (!title) {
          return
        }

        var weight = selectText(select(row, 'td')[2], 'p')

        items.push({
          title: title,
          weight: weight,
          tags: [
            "ecobuffet",
            "екобуфет"
          ]
        })
      });

      callback();
    };

    req('http://www.eco-buffet.com/obed-za-38-grn', parseEcobuffetPage, function(err) {
      if (err) return callback(err);

      callback(null, {
        title: 'Eco-buffet',
        name: 'ecobuffet',
        href: 'http://www.eco-buffet.com/',
        singleBox: true,
        days: days
      });
    });
  },

  /**
   * Static Alma
   */
  alma: function(callback) {
    callback(null, {
      title: "Alma Mater",
      name: "alma",
      type: "static"
    })
  },

  /**
   * Static Gastromix
   */
  gastromix: function(callback) {
    callback(null, {
      title: "GastroMix",
      name: "gastromix",
      type: "static",
      singleBox: true
    })
  },

  vegano: function(callback) {
    callback(null, {
      title: 'Vegano',
      name: 'vegano',
      href: 'http://veganohooligano.com.ua/catering/',
      menu: [
        {
          title: '',
          type: 'first-second',
          items: [
            {
              title: 'Вегано-хавчик',
              price: 55
            },
            {
              title: 'Вегано-хавчик (без соли)',
              price: 55
            }
          ]
        }
      ],
      tags: [
        "vegano",
        "вегано"
      ]
    });
  },

  capo: function(callback) {
    callback(null, {
      title: 'Capo',
      name: 'capo',
      href: 'http://capo.com.ua/business-lunch/',
      menu: [
        {
          title: '',
          type: 'first-second',
          items: [
            {
              title: 'Бизнес ланч',
              price: 49
            },
            {
              title: 'Японский бизнес ланч',
              price: 49
            }
          ]
        }
      ],
      tags: [
        "capo",
        "сапо",
        "капо"
      ]
    });
  },

  imbir: function(callback) {
    callback(null, {
      title: 'Imbir',
      name: 'imbir',
      href: 'https://www.facebook.com/cafeimbir',
      menu: [
        {
          title: '',
          type: 'first-second',
          items: [
            {
              title: 'Бизнес ланч',
              price: 60
            }
          ]
        }
      ],
      tags: [
        "imbir",
        "имбирь",
        "імбир"
      ]
    });
  },

  seagrace: function(callback) {
    callback(null, {
      title: 'Say grace',
      name: 'saygrace',
      href: 'https://docs.google.com/a/grammarly.com/forms/d/1dmzEh_5_xlCUcvJrGVxOeDYwbf_Kep87ds_RO_ue6lI/formResponse',
      hasDailyMenu: true,
      tags: [
        "saygrace",
        "сейгрейс"
      ],
      menu: [
        {
          title: '',
          type: 'lunch',
          items: [
            {
              title: 'Ланч меню',
              price: 69,
              opts: true,
              items: [
                {
                  title: 'Суп',
                  options: [
                    {
                      title: 'крем свекольный с Горгондзолой',
                      selected: true
                    },
                    {
                      title: 'консоме куриное'
                    }
                  ]
                },
                {
                  title: 'Салат',
                  options: [
                    {
                      title: 'айсберг (киви, моцарелла, низкокалорийная заправка)',
                      selected: true
                    }
                  ]
                },
                {
                  title: 'Сендвич',
                  options: [
                    {
                      title: 'с курицей',
                      selected: true
                    },
                    {
                      title: 'с адыгейским сыром'
                    }
                  ]
                }
              ],
              description: 'Суп - крем свекольный с Горгондзолой/ консоме куриное \
                            Салат айсберг, киви, моцарелла, низкокалорийная заправка \
                            Сендвич с курицей/ адыгейским сыром'
            }
          ]
        },
        {
          title: '',
          type: 'first-second',
          items: [
            {
              title: 'Суп дня: свекольный крем- суп с сыром Горгондзола',
              price: 10,
              date: '2014-12-08'
            },
            {
              title: 'Салат: салат айсберг, киви, моцарелла , низкокалорийный соус',
              price: 15,
              date: '2014-12-08'
            },
            {
              title: 'Десерт: Львовский сырник , рождественские пряники',
              price: 17,
              date: '2014-12-08'
            },
            {
              title: 'Суп дня: крем- суп шампиньоновый',
              price: 10,
              date: '2014-12-09'
            },
            {
              title: 'Салат: тальятелле из свеклы и моркови с сыром Бри',
              price: 15,
              date: '2014-12-09'
            },
            {
              title: 'Десерт: вегетарианский тыквенно- шоколадный торт/ бланманже',
              price: 17,
              date: '2014-12-09'
            },
            {
              title: 'Суп дня: овощной с розмарином;',
              price: 10,
              date: '2014-12-10'
            },
            {
              title: 'Салат дня: яйцо-пашот с помидорами и сыром Бри;',
              price: 15,
              date: '2014-12-10'
            },
            {
              title: 'Десерт дня: тыквенный сырой торт / дюкан-бланманже с шоколадным топпингом;',
              price: 17,
              date: '2014-12-10'
            },
            {
              title: 'Суп дня: крем- суп морковно- имбирный',
              price: 10,
              date: '2014-12-11'
            },
            {
              title: 'Салат: Тофу Капрезе',
              price: 15,
              date: '2014-12-11'
            },
            {
              title: 'Десерт: вегетарианский тыквенно- шоколадный торт/ творожный пирог',
              price: 17,
              date: '2014-12-11'
            },
            {
              title: 'Суп дня: крем-суп грибной',
              price: 10,
              date: '2014-12-12'
            },
            {
              title: 'салат овощной из брокколи, красной капусты, моркови , маринованного салатного лука и сметанно-оливковой заправки',
              price: 15,
              date: '2014-12-12'
            },
            {
              title: 'десерты: дю-паннка котта, вегетарианские торты',
              price: 17,
              date: '2014-12-12'
            }
          ]
        }
      ]
    });
  },

  fridge: function(callback) {
    callback(null, {
      title: 'Fridge',
      name: 'fridge',
      tags: [
        "фридж",
        "fridge",
        "холодильник"
      ],
      href: null,
      menu: [
        {
          title: 'Beigels & Sandwiches',
          type: 'first-second',
          items: [
            {
              title: 'Сендвич нью-йорк',
              price: 30
            },
            {
              title: 'Сендвич киев',
              price: 30
            },
            {
              title: 'Бейгл с авокадо',
              price: 35
            },
            {
              title: 'Бейгл c витчиной',
              price: 25
            },
            {
              title: 'Бейгл с моцареллой',
              price: 30
            },
            {
              title: 'Бейгл с салями и витчиной',
              price: 30
            },
            {
              title: 'Бейгл с лососем',
              price: 25
            },
            {
              title: 'Бейгл с тунцом',
              price: 30
            }
          ]
        },
        {
          title: 'Salads',
          type: 'first-second',
          items: [
            {
              title: 'Салат Цезарь',
              price: 25
            },
            {
              title: 'Салат Греческий',
              price: 25
            },
            {
              title: 'Салат с витчиной',
              price: 20
            },
            {
              title: 'Салат с лососем',
              price: 30
            },
            {
              title: 'Салат с курицай',
              price: 25
            }
          ]
        },
        {
          title: 'Deserts',
          type: 'first-second',
          items: [
            {
              title: 'Яблочный пирог',
              price: 15
            },
            {
              title: 'Торт Наполеон',
              price: 15
            },
            {
              title: 'Чизкейк Нью-Йорк',
              price: 20
            },
            {
              title: 'Йогуртовый дисерт',
              price: 20
            },
            {
              title: 'Медовик',
              price: 15
            }
          ]
        },
        {
          title: 'Soups',
          type: 'first-second',
          items: [
            {
              title: 'Суп грибной',
              price: 21
            },
            {
              title: 'Суп куриный',
              price: 17
            }
          ]
        }
      ]
    });
  },

  pingpong: function(callback) {

    var parsePingpongPage = function($, callback) {
      var result = [];

      $('.products_table > tbody > tr > td').each(function(i, item) {
        var $item = $(this)
        var priceTxt = $item.find('.prod_price').text(),
          priceNum = priceTxt.replace(/[^\d]/, ''),
          price = parseInt(priceNum, 10) / 100

        if (isNaN(price)) return

        var title = $item.find('.title2_font').text(),
          description = $item.find('.a_font').text(),
          weight = parseInt($item.find('span i').text(), 10)

        result.push({
          title: title,
          description: description,
          price: price,
          weight: weight
        });
      });

      callback(null, result);
    }

    var parallelJobs = [],
      categories = ['noodles', 'rice', 'salads', 'soups', 'sides', 'drinks', 'sauce'];

    categories.forEach(function(category) {
      parallelJobs.push(function(callback) {
        reqCheerio('http://ping-pong.ua/catalog/' + category + '/', parsePingpongPage, function(err, items) {
          var type;
          switch (category) {
            case 'soups':
              type = 'first'
              break
            case 'rice':
            case 'noodles':
            case 'sides':
            case 'sauce':
              type = 'second'
              break
            case 'drinks':
            case 'salads':
              type = 'third'
              break
            default:
              type = 'first-second'
          }
          callback(err, {
            title: ucfirst(category),
            type: type,
            items: items
          });
        });
      });
    });

    async.parallel(parallelJobs, function(err, result) {
      if (err) return callback(err);
      // Result JSON
      callback(null, {
        title: 'Ping-Pong',
        name: 'pingpong',
        href: 'http://ping-pong.ua/',
        menu: result,
        tags: [
          "pingpong",
          "ping-pong",
          "пинпонг",
          "пин-понг"
        ]
      });
    });
  }
}

/**
 * Helpers
 */

/**
 * Same as jQuery.fn.text()
 * @param  {Array} nodes (nodes from select())
 * @return {String}       Aggregated text
 */
function text(nodes) {
  var text = [];
  nodes.forEach(function(node) {
    (node.children || []).filter(function(child) {
      return child.type == 'text';
    }).forEach(function(child) {
      text.push(child.raw);
    });
  });
  return text.join('');
}

/**
 * Transform html entities to string
 * @param  {String} str string with html entities
 * @return {String}     normal string
 */
function unhtmlentities(str) {
  return str.replace(/&#([0-9]{2,4});?/gi, function(m, code) {
    return String.fromCharCode(+code)
  })
}

/**
 * Wrapper for quick text selecton from DOM elements
 * @param  {Array} dom      (DOM from htmlparser or nodes from select())
 * @param  {String} selector  soupselect selector
 * @return {String}          Aggregated text
 */
function selectText(dom, selector) {
  if (!dom) return ''
  return text(select(dom, selector));
}

/**
 * Same as jQuery.fn.attr()
 * @param  {Array} nodes (nodes from select())
 * @param  {String} attr  Attribute you want to get
 * @return {String}       Attribute value
 */
function attr(nodes, attrName) {
  if (!nodes.length) return null;
  if (!nodes[0].attribs) return null;
  return nodes[0].attribs[attrName];
}

/**
 * Wrapper for quick attr selecton from DOM elements
 * @param  {Array} dom      (DOM from htmlparser or nodes from select())
 * @param  {String} selector  soupselect selector
 * @param  {String} attr  Attribute you want to get
 * @return {String}       Attribute value
 */
function selectAttr(dom, selector, attrName) {
  return attr(select(dom, selector), attrName);
}

/**
 * Helper wrapper for parsing body
 * @param  {String}   body     Raw html body
 * @param  {Function} callback   Dom processing function
 * @return {void}
 */
function parse(body, callback) {
  // now we have the whole body, parse it and select the nodes we want...
  var handler = new htmlparser.DefaultHandler(callback);
  var parser = new htmlparser.Parser(handler);
  parser.parseComplete(body);
}

/**
 * Request given url, parse html into dom, executes given handler
 * @param  {String}   url       Page you want to parse
 * @param  {Function} handler   Async dom handler function function(dom, callback){}
 * @param  {Function} callback  Callback which will be passend into handler
 * @return {void}
 */
function req(url, handler, callback) {
  request(url, function(err, response, body) {
    if (err) return callback(err);
    if (response.statusCode !== 200) return callback('Response statusCode: ' + response.statusCode);
    parse(body, function(err, dom) {
      if (err) return callback(err);
      dom.pageUrl = url;
      handler(dom, callback);
    });
  });
}

/**
 * Request given url, parse html into dom, executes given handler
 * @param  {String}   url       Page you want to parse
 * @param  {Function} handler   Async dom handler function function(dom, callback){}
 * @param  {Function} callback  Callback which will be passend into handler
 * @return {void}
 */
function reqCheerio(url, handler, callback) {
  request(url, function(err, response, body) {
    if (err) return callback(err);
    if (response.statusCode !== 200) return callback('Response statusCode: ' + response.statusCode);
    var $ = cheerio.load(body);
    $.pageUrl = url;
    handler($, callback)
  });
}

/**
 * Capitalize first letter
 * @param  {String} string String
 * @return {String}
 */
function ucfirst(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Print prettified JSON
 * @param  {object} data
 * @param varName
 * @return {void}
 */
function printJson(data, varName) {
  console.log(varName + ' = ' + JSON.stringify(data, true, '  '));
}
