Next step to be super human.

Explore interfaces between AI and human.

## Latest Status
Basic structure built:
- Find thoughts from text via basic LLM inference.
- Store all data into PostgreSQL:
  - Thoughts, sources -> PostgreSQL tables (relational database)
  - embedding of thought text -> pgvector (vector database)
  - Relationship between and within thoughts, sources -> Apache AGE (knowledge graph)
- Basic backend API (FastAPI)
- Basic web page to interact with backend API (SvelteKit)

## Get Started
[Online demo](https://conscious.ittia.net)

[Full user manual](./docs/manual.md)

Local deploy:
```bash
git clone https://github.com/ittia-research/conscious
cd conscious

# Below are for production, switch `prod` and `dev` if want to start services for development
docker compose --profile utils up -d  # Start utility services
docker compose --profile dev down  # Optional: prod and dev share some ports and can't start at the same time
docker compose --profile prod up -d  # Start in background
docker compose --profile prod logs -f  # Follow services logs
```

## Goals
- Find thoughts (knowledge, ideas) that are not within memory.
- Store new thoughts into AI memory.
- Sync between AI and human memory.
- Memory could belong to a individual, a group, or a organization.
- Memory could be linked together (federation).
- Integrate with existing knowledge bases. For example, Obsidian.

And in doing so, hopefully unlock some secrets about conscious.

## Theory
- Reading in a lot of times are to find some missing puzzles.
- People might learn better with the Zone of Proximal Development.

## Guidelines
- No word salad.

## Links
[TO-DO](./docs/todo.md)

## Acknowledgements
- TPU Research Cloud team at Google
- Google (Gemini, Search)
