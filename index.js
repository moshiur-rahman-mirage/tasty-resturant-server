const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;
const sharp = require("sharp");

// middleware
// app.use(cors({
//     origin: [
//          'https://resturant-9e927.web.app'
//     ],
//     credentials: true
// }));


app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});


const corsOptions ={
    origin:['https://resturant-9e927.web.app', 
    'http://localhost:5173'],
    credentials:true,            //access-control-allow-credentials:true
    optionSuccessStatus:200
}
app.use(cors(corsOptions));


// app.use(express.json());
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));

app.use(cookieParser());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hhabjy4.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// middlewares 
const logger = (req, res, next) =>{
    console.log('log: info', req.method, req.url);
    next();
}

const verifyToken = (req, res, next) =>{
    const token = req?.cookies?.token;
    if(!token){
        return res.status(401).send({message: 'unauthorized access'})
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
        if(err){
            return res.status(401).send({message: 'unauthorized access'})
        }
        req.user = decoded;
        next();
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const menuCollection = client.db('Resturant').collection('Menu');
        const orderCollection = client.db('Resturant').collection('Order');
      

        // auth related api
        app.post('/jwt', logger, async (req, res) => {
            const user = req.body;
            console.log('user for token', user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            })
                .send({ success: true });
        })

        app.post('/logout', async (req, res) => {
            const user = req.body;
            console.log('logging out', user);
            res.clearCookie('token', { maxAge: 0 }).send({ success: true })
        })

   
        app.get('/menu', async (req, res) => {
            const cursor = menuCollection.find().sort( { "order_qty": -1 } ).limit(6);;
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/menu/all', async (req, res) => {
            const cursor = menuCollection.find().sort( { "order_qty": -1 } );
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/pagemenu', async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
            console.log(page)
            console.log(size)
            const result = await menuCollection.find().sort( { "order_qty": -1 })
            .skip(page * size)
            .limit(size)
            .toArray();
            res.send(result);
          })

          app.get('/menucount', async (req, res) => {
            const count = await menuCollection.estimatedDocumentCount();
            res.send({ count });
          })





        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }

            const options = {
                projection: { name: 1, rate: 1, category: 1,country_of_origin:1, image: 1,creator:1,image_links:1,available_qty:1 },
            };

            const result = await menuCollection.findOne(query, options);
            res.send(result);
        })

        app.post('/menu', async (req, res) => {
            const menu = req.body;
            console.log(menu);
            const result = await menuCollection.insertOne(menu);
            res.send(result);
        });


        // orders 
        app.get('/orders',logger, verifyToken,  async (req, res) => { //
            if(req.user.email !== req.query.email){
                return res.status(403).send({message: 'forbidden access'})
            }
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await orderCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/orders', async (req, res) => {
            const order = req.body;
            console.log(order);
            const result = await orderCollection.insertOne(order);
            res.send(result);
        });

        app.patch('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedorder = req.body;
            console.log(updatedorder);
            const updateDoc = {
                $set: {
                    status: updatedorder.status
                },
            };
            const result = await orderCollection.updateOne(filter, updateDoc);
            res.send(result);
        })



        app.post('/mealupdate/:id', async (req, res) => {
            console.log('hhh')
            const id = req.params.id;
            const incval=req.body.count
            const filter = { _id: new ObjectId(id) };
              const update = {
                $inc: { order_qty: incval,available_qty:0-incval },
                
              };
          
             const result = await menuCollection.updateOne(filter, update);
             res.send(result)
            });
          

        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Resturant is running')
})

app.listen(port, () => {
    console.log(`Resturant Server is running on port ${port}`)
})