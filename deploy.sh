#!/usr/bin/env bash

cd $(dirname $0)
BASE_DIR=$PWD

#START
cd $BASE_DIR


IMAGE_NAME="whatsapp-api"
BACKEND_HOST="bg-api-us"
BACKEND_PATH="whatsapp"
DIFF_SRC_PATH=$BASE_DIR/

echo ""
echo "Comparing backend files..."
echo ""

echo "Creating a backup on the remote server..."
ssh $BACKEND_HOST "rm -rf backups/$BACKEND_PATH\2 && mv backups/$BACKEND_PATH\1 backups/$BACKEND_PATH\2"
ssh $BACKEND_HOST "rsync -aq --mkpath $BACKEND_PATH/* backups/$BACKEND_PATH\1 --exclude uploads --exclude logs --exclude docs --exclude node_modules"

echo ""
echo "Uploading backend files..."

rsync --info=progress2 --del -rt "$DIFF_SRC_PATH" $BACKEND_HOST:$BACKEND_PATH --exclude-from=$DIFF_SRC_PATH.gitignore

echo "Running migrations..."
ssh $BACKEND_HOST "source .bashrc && cd $BACKEND_PATH && bun migrate"

echo "Stopping docker container..."
ssh $BACKEND_HOST "docker stop $IMAGE_NAME"

echo "Starting docker container..."
ssh $BACKEND_HOST "cd $BACKEND_PATH && docker compose up -d"
