DOCKERINFO=$(curl -s --unix-socket /run/docker.sock http://docker/containers/$HOSTNAME/json)
export ID=$(python -c "import sys, json; print(json.loads(sys.argv[1])[\"Name\"].split(\"_\")[-1])" "$DOCKERINFO")
