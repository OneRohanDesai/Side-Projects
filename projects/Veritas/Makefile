.PHONY: api ui dev test agent sample

api:
	cargo run -p veritas-api

ui:
	cd ui && npm run dev

dev:
	./scripts/dev.sh

test:
	cargo test --workspace
	cd ui && npm run build
	cd agents/veritas-agent && go build -o veritas-agent .

agent:
	cd agents/veritas-agent && go run . -once

sample:
	@python3 -c "import json; d=json.load(open('sample-data/system.json')); print(f\"entities={len(d['entities'])} incidents={len(d['incidents'])} narrative={d['narrative']}\")"
