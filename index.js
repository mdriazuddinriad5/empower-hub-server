const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config();


// middlewares
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
        await client.connect();

        const serviceCollection = client.db("eHubDb").collection("services");
        const queryCollection = client.db("eHubDb").collection("queries");
        const userCollection = client.db("eHubDb").collection("users");

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

        app.post('/users', async (req, res) => {
            const item = req.body;
            const result = await userCollection.insertOne(item);
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
    res.send("Empowering employees");
})

app.listen(port, () => {
    console.log(`Employees running on ${port}`);
})