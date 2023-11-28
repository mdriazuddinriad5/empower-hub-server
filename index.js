const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT || 5000;



// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jwhv1v2.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const serviceCollection = client.db("eHubDb").collection("services");
        const queryCollection = client.db("eHubDb").collection("queries");
        const userCollection = client.db("eHubDb").collection("users");


        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })

        // middlewares
        const verifyToken = (req, res, next) => {
            // console.log("Token to Verify", req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            console.log(token);
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === "admin";
            if (!isAdmin) {
                return res.status(403).send({ message: "Forbidden" })
            }
            next();
        }


        const verifyHr = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isHr = user?.role === "hr";
            if (!isHr) {
                return res.status(403).send({ message: "Forbidden" })
            }
            next();
        }



        // service related api

        app.get('/services', async (req, res) => {
            const result = await serviceCollection.find().toArray();
            res.send(result);
        })

        app.post('/user-query', async (req, res) => {
            const uQuery = req.body;
            const result = queryCollection.insertOne(uQuery);
            res.send(result);
        })

        // user related api

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const item = req.body;
            const result = await userCollection.insertOne(item);
            res.send(result);
        })



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send("Empowering employees");
})

app.listen(port, () => {
    console.log(`Employees running on ${port}`);
})