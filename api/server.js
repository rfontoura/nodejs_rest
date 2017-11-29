var express = require('express');
var bodyParser = require('body-parser');
var mongodb = require('mongodb');
var objectId = require('mongodb').ObjectId;
var multiparty = require('connect-multiparty');
var fs = require('fs'); // módulo filesystem

var app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(multiparty());

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');

    // tratando preflight requests (que ocorrem ao executar PUT ou DELETE via navegador)
    // permita que header 'contet-type' do cabeçalho seja modificado pela requisição
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);

    next();
});

var port = 8080;

app.listen(port);

var db = new mongodb.Db(
    'instagram', // base de dados
    new mongodb.Server('localhost', 27017, {})
);

console.log('Servidor HTTP escutando na porta ' + port);

app.get('/', function (req, res) {
    res.send({ msg: 'Olá' })
});

app.post('/api', function (req, res) {
    var timestamp = new Date().getTime();

    // movendo arquivo fornecido na requisição para diretório 'uploads'
    var urlImagem = timestamp + req.files.arquivo.originalFilename;
    var pathOrigem = req.files.arquivo.path; // caminho temporário do arquivo no servidor
    var pathDestino = './uploads/' + urlImagem;

    fs.rename(pathOrigem, pathDestino, function (err) {
        if (err) {
            res.status(500).json({ error: err });
            return;
        }

        var dados = {
            url_imagem: urlImagem,
            titulo: req.body.titulo
        };

        db.open(function (err, mongoclient) {
            mongoclient.collection('postagens', function (err, collection) {
                collection.insert(dados, function (err, records) {
                    if (err) {
                        res.json(err);
                    } else {
                        res.json(records.ops[0]._id + " inserido.");
                    }
                    mongoclient.close();
                });
            });
        });
    });
});

app.get('/api', function (req, res) {
    db.open(function (err, mongoclient) {
        mongoclient.collection('postagens', function (err, collection) {
            collection.find().toArray(function (err, results) {
                if (err) {
                    res.json(err);
                } else {
                    res.json(results);
                }
                mongoclient.close();
            });
        });
    });
});

// get by id
app.get('/api/:id', function (req, res) {
    db.open(function (err, mongoclient) {
        mongoclient.collection('postagens', function (err, collection) {
            var idElemento = objectId(req.params.id);
            collection.find({ _id: idElemento }).toArray(function (err, results) {
                if (err) {
                    res.json(err);
                } else {
                    res.status(200).json(results);
                }
                mongoclient.close();
            });
        });
    });
});

// recuperação das imagens
app.get('/imagens/:imagem', function (req, res) {
    var img = req.params.imagem;
    fs.readFile('./uploads/' + img, function (err, content) {
        if (err) {
            res.status(400).json(err);
            return
        }

        // escreve vários valores de um header no response de uma vez só
        res.writeHead(200, { 'content-type': 'image/jpg' });
        res.end(content);
    });
});

// ao efetuar PUT a partir do navegador, é feita intrinsicamente uma requisição OPTIONS por segurança
// put by id (update)
app.put('/api/:id', function (req, res) {

    var idElemento = objectId(req.params.id);
    var comentario = req.body.comentario;

    db.open(function (err, mongoclient) {
        mongoclient.collection('postagens', function (err, collection) {
            collection.update(
                { _id: idElemento },

                // $push inclui valor num atributo que é um array
                {
                    $push: {
                        comentarios: {
                            id_comentario: new objectId(),
                            comentario: req.body.comentario
                        }
                    }
                },
                {},
                function (err, records) {
                    if (err) {
                        res.json(err);
                    } else {
                        res.json(records);
                    }

                    mongoclient.close();
                });
        });
    });
});

// delete
app.delete('/api/:id', function (req, res) {
    db.open(function (err, mongoclient) {
        mongoclient.collection('postagens', function (err, collection) {
            var idElemento = objectId(req.params.id);
            collection.update(
                {},
                {
                    $pull: {
                        comentarios: { id_comentario: objectId(idElemento) }
                    }
                },
                { multi: true },
                function (err, records) {
                    if (err) {
                        res.json(err);
                    } else {
                        res.json(records);
                    }

                    mongoclient.close();
                });
        });
    });
});