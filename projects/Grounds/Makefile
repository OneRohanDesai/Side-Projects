.PHONY: help doctor menu list progress catalog nimbus localstack linux kind stop

help:
	@echo "make doctor | menu | list | progress | catalog | nimbus | localstack | linux | kind | stop"

doctor:
	./bin/grounds doctor

menu:
	./bin/grounds

list:
	./bin/grounds list

progress:
	./bin/grounds progress

catalog:
	python3 tools/generate-catalog.py
	python3 tools/write-implemented-scenarios.py

nimbus:
	./bin/grounds infra up nimbus

localstack:
	./bin/grounds infra up localstack

linux:
	./bin/grounds infra up linux

kind:
	./bin/grounds infra up kind

stop:
	./bin/grounds infra down
