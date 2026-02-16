import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM recipes ORDER BY id DESC');
        res.render("index", { recipes: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

    app.post("/add-recipe", async (req, res) => {
        const { title, description, ingredients, instructions } = req.body;
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const recipeRes = await client.query(
                'INSERT INTO recipes (title, description) VALUES ($1, $2) RETURNING id',
                [title, description]
            );
            const recipeId = recipeRes.rows[0].id;

            for (let ing of ingredients) {
                const ingRes = await client.query(
                    'INSERT INTO ingredients (name VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id',
                    [ing.name]
                );
                const ingredientId = ingRes.rows[0].id;
                await client.query(
                    'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount) VALUES ($1, $2, $3)',
                    [recipeId, ingredientId, ing.amount]
                );
            }
            for (let i = 0; i < instructions.length; i++) {
                await client.query(
                    'INSERT INTO instructions (recipe_id, step_number, instruction_text) VALUES($1, $2, $3)',
                    [recipeId, i + 1, instructions[i]]
                );
            }

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json( 'ROLLBACK');
            console.error(err);
            res.status(500).json({ error: "Transaction failed" });
        } finally {
            client.release();
        }
        });

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
    
