Manual on how to use.

## Self-hosting
Prepare:
- Update env in corresponding files.
- Create MinIO bucket and API key manually.

### For Production
```bash
git clone https://github.com/ittia-research/conscious
cd conscious

docker compose --profile utils up -d  # Start utility services
docker compose --profile dev --profile prod down  # Remove started previous if any
docker compose --profile prod up -d  # Start

# Optional
docker compose --profile prod logs -f  # Check logs
```

### For Development
```bash
git clone https://github.com/ittia-research/conscious
cd conscious

docker compose --profile utils up -d  # Start utility services
docker compose --profile dev --profile prod down  # Remove started previous if any
docker compose --profile dev up -d  # Start

# Optional
docker compose --profile dev logs -f  # Check logs
```

## Shortcuts
Flashcard review:
- review rating: 1 ~ 4
- speak: s, space
- discard: d

## Resources
### Models
#### Google AI
You may create free API key from [Google AI](https://aistudio.google.com/apikey).

To list all models:
```python
from google import genai

API_KEY = "YOUR_API_KEY_HERE"

client = genai.Client(api_key=API_KEY)

for model in client.models.list():
    print(model)
```

### Embedding
[MTEB Embedding Leaderboard](https://huggingface.co/spaces/mteb/leaderboard) has a comprehensive list of most advanced embedding models.

You may choose one and self-hosting, they usually costs much less hardware resources compare to advanced LLM.
