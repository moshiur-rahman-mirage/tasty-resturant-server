const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;
const sharp = require("sharp");







app.use(
    cors({
        origin: ['http://localhost:5173', 'https://resturant-9e927.web.app'],
        credentials: true,
    }),
)


app.use(express.json());


app.use(cookieParser());




const secret="e9b649b06350d673d9fa7cf7f6eb224289f03cdac0efcc368b6d1ce1c49463a03e7a4299a59b86e96751614e28ca81d0e2e641fe3e317fdb088378af87ff7101"

//const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hhabjy4.mongodb.net/?retryWrites=true&w=majority`;

const uri = `mongodb+srv://librarian:Ms121212@cluster0.hhabjy4.mongodb.net/?retryWrites=true&w=majority`;



const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


const logger = (req, res, next) =>{
    console.log('log: info', req.method, req.url);
    next();
}
const verifyToken = (req, res, next) =>{
    const token = req?.cookies?.token;
    if(!token){
        return res.status(401).send({message: 'unauthorized access'})
    }
    jwt.verify(token, secret, (err, decoded) =>{
        if(err){
            return res.status(401).send({message: 'unauthorized access'})
        }
        req.user = decoded;
        next();
    })
}

async function run() {
    try {
        await client.connect();

        const menuCollection = client.db('Resturant').collection('Menu');
        const orderCollection = client.db('Resturant').collection('Order');
      

        // auth related api
        app.post('/jwt', logger, async (req, res) => {
            const user = req.body;
            console.log('user for token', user);
            const token = jwt.sign(user, secret, { expiresIn: '1h' });

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



        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Resturant is running')
})

app.listen(port, () => {
    console.log(`Resturant Server is running on port ${port}`)
})