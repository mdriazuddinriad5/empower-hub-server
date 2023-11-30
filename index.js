const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;



// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const workEntries = client.db("eHubDb").collection("workEntries");
        const paymentCollection = client.db("eHubDb").collection("payment");


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

        app.get('/user/:id', verifyToken, verifyHr, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await userCollection.findOne(filter);
            res.send(result);
        })

        app.get('/employee-list', verifyToken, verifyHr, async (req, res) => {
            const allUsers = await userCollection.find().toArray();
            const employees = allUsers.filter(user => user.role === 'employee');
            res.send(employees);
        });

        app.get('/users/admin/:email', verifyToken, async (req, res) => {  // this one is for admin followed by jwt
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden access" });
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);

            let admin = false;
            if (user) {
                admin = user?.role === "admin";
            }
            res.send({ admin });
        })

        app.get('/users/hr/:email', verifyToken, async (req, res) => {  // this one is for hr followed by jwt
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden access" });
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);

            let hr = false;
            if (user) {
                hr = user?.role === "hr";
            }
            res.send({ hr });
        })


        app.post('/users', async (req, res) => {
            const item = req.body;
            const result = await userCollection.insertOne(item);
            res.send(result);
        })


        app.patch('/user-verify/:id', verifyToken, verifyHr, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const verifiedUser = req.body;
            console.log(verifiedUser);
            const updateDoc = {
                $set: {
                    verified: verifiedUser.verified
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })


        // employee payment related api


        app.post('/submit-work-entry', async (req, res) => {
            const { task, hoursWorked, date, email } = req.body;

            try {
                const hourlyRates = {
                    Sales: 20,
                    Support: 15,
                    Content: 25,
                    'Paper-work': 10,
                };
                const hourlyRate = hourlyRates[task] || 0;
                const amount = hourlyRate * hoursWorked;

                const existingEntry = await workEntries.findOne({
                    month: new Date(date).getMonth() + 1,
                    year: new Date(date).getFullYear(),
                });

                if (existingEntry) {

                    existingEntry.totalAmount += amount;
                    await db.collection('workEntries').updateOne(
                        { _id: ObjectId(existingEntry._id) },
                        { $set: { totalAmount: existingEntry.totalAmount } }
                    );
                } else {
                    await workEntries.insertOne({
                        task,
                        hoursWorked,
                        date,
                        amount,
                        email
                    });
                }

                res.json({ message: 'Work entry submitted successfully' });
            } catch (error) {
                console.error('Error submitting work entry:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });


        app.get('/get-work-entries', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            try {
                const work = await workEntries.find(query).toArray();
                res.send(work);
            } catch (error) {
                console.error('Error fetching work entries:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });


        // payment intent

        app.post('/create-payment-intent', async (req, res) => {
            const { salary } = req.body;
            const amount = salary * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })




        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);
            res.send({ paymentResult })
        })





        app.get('/payment', async (req, res) => {
            const employeeId = req.query.employeeId;
            const query = { employeeId: employeeId };
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/payments', verifyToken, verifyHr, async (req, res) => {

            const employeeId = req.query.employeeId;
            const date = req.query.date;
            const matchingPayments = await paymentCollection.find({
                employeeId: employeeId,
                date: date,
            }).toArray();

            res.send(matchingPayments)

        });


        app.get('/person-payments/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email };
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const result = await paymentCollection.find(query).toArray();
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