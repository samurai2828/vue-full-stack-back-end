import express from "express";
import dotenv from "dotenv";
dotenv.config();
// import { cartItems as cartItemsRaw, products as productsRaw } from "./temp-data.js";
import { MongoClient } from "mongodb";
import path from "path";

// let cartItems = cartItemsRaw;
// let products = productsRaw;

async function start() {
	/* Mongo DB */
	const client = new MongoClient(process.env.MONGODB_CONNECTION);
	await client.connect();
	const db = client.db("fsv-db");
	/* End Mongo DB */

	/* Express */
	const app = express();
	app.use(express.json());
	app.use("/images", express.static(path.join(__dirname, "../assets")));
	app.use(express.static(path.resolve(__dirname, "../dist"), { maxAge: "1y", etag: false }));

	const Port = process.env.PORT || 3000;
	/* End Express */

	app.get("/api/products", async (req, res) => {
		const products = await db.collection("products").find({}).toArray();
		res.send(products);
	});

	async function populatedCartIds(ids) {
		return Promise.all(ids.map((id) => db.collection("products").findOne({ id })));
	}

	app.get("/api/users/:userId/cart", async (req, res) => {
		const user = await db.collection("users").findOne({ id: req.params.userId });
		const populatedCart = await populatedCartIds(user?.cartItems || []);
		res.json(populatedCart);
	});

	app.get("/api/products/:productId", async (req, res) => {
		const productId = req.params.productId;
		const product = await db.collection("products").findOne({ id: productId });
		res.json(product);
	});

	app.post("/api/users/:userId/cart", async (req, res) => {
		const userId = req.params.userId;
		const productId = req.body.id;
		// const product = products.find((product) => product.id === productId);

		const existingUser = await db.collection("users").findOne({ id: userId });
		if (!existingUser) {
			await db.collection("users").insertOne({
				id: userId,
				cartItems: [],
			});
		}
		await db.collection("users").updateOne(
			{ id: userId },
			{
				$addToSet: { cartItems: productId },
			}
		);
		const user = await db.collection("users").findOne({ id: req.params.userId });
		const populatedCart = await populatedCartIds(user?.cartItems || []);
		res.json(populatedCart);
	});

	app.delete("/api/users/:userId/cart/:productId", async (req, res) => {
		const userId = req.params.userId;
		const productId = req.params.productId;
		await db.collection("users").updateOne(
			{ id: userId },
			{
				$pull: { cartItems: productId },
			}
		);

		const user = await db.collection("users").findOne({ id: req.params.userId });
		const populatedCart = await populatedCartIds(user?.cartItems || []);
		res.json(populatedCart);
	});

	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname, "../dist/index.html"));
	});

	app.listen(Port, () => {
		console.log(`Listening on ${Port}`);
	});
}

start();
