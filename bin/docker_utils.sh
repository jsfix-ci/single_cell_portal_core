#!/usr/bin/env bash

# shell shortcuts for starting/stopping/removing docker containers

THIS_DIR="$(cd "$(dirname "$0")"; pwd)"

# load common utils

. $THIS_DIR/bash_utils.sh

# defaults

PORTAL_DOCKER_CONTAINER="single_cell"
PORTAL_DOCKER_CONTAINER_VERSION="latest"

# TODO: rethink naming for functions that start with "set", echoing my comment in extract_vault_secrets.sh
# set the docker container name
function set_container_name {
    CONTAINER="$1"
    if [[ -z $CONTAINER ]]; then
        CONTAINER="$PORTAL_DOCKER_CONTAINER"
    fi
    echo "$CONTAINER"
}

# set a name & version for an image when building
function set_image_name {
    IMAGE="$1"
    VERSION="$2"
    if [[ -z $IMAGE ]]; then
        IMAGE="$PORTAL_DOCKER_CONTAINER"
    fi
    if [[ -z $VERSION ]]; then
        VERSION="$PORTAL_DOCKER_CONTAINER_VERSION"
    fi
    echo "$IMAGE:$VERSION"
}

# get all containers (stopped or running)
function get_all_containers {
    echo $(docker ps -a --format '{{.Names}}') || exit_with_error_message "could not list all containers"
}

# get all running containers
function get_running_containers {
    echo $(docker ps -a --format '{{.Names}}' -f=status=running) || exit_with_error_message "could not list running containers"
}

# stop a docker container
function stop_docker_container {
    CONTAINER_NAME=$(set_container_name $1)
    docker stop $CONTAINER_NAME || exit_with_error_message "docker could not stop container: $CONTAINER_NAME"
}

# remove a container
function remove_docker_container {
    CONTAINER_NAME=$(set_container_name $1)
    docker rm $CONTAINER_NAME || exit_with_error_message "docker could not stop container: $CONTAINER_NAME"
}

# build a new docker image
function build_docker_image {
    SOURCE_PATH="$1"
    REQUESTED_NAME="$2"
    REQUESTED_VERSION="$3"
    IMAGE_NAME="$(set_image_name $REQUESTED_NAME $REQUESTED_VERSION)"

    docker build -t "$IMAGE_NAME" -f $SOURCE_PATH/Dockerfile $SOURCE_PATH || exit_with_error_message "could not navigate to source directory $SOURCE_PATH"
}

# ensure that container is running
function ensure_container_running {
    CONTAINER_NAME=$(set_container_name $1)
    RUNNING_CONTAINERS=$(get_running_containers)
    RUNNING=1
    for CONTAINER in $RUNNING_CONTAINERS; do
        if [[ "$CONTAINER" = "$CONTAINER_NAME" ]]; then
            RUNNING=0
        fi
    done
    echo "$RUNNING"
}

# get all matching images, will return image IDs in the order of most recent first
function get_matching_image_ids {
    IMAGE_NAME="$1"
    IMAGES=$(docker images | grep -F $IMAGE_NAME | awk '{ print $3 }')
    echo $IMAGES
}

# remove all but the most recent release image
function prune_docker_artifacts {
    INDEX=0
    if [[ "$SHELL" = '/bin/zsh' ]]; then
        echo "zsh detected, setting array index to 1"
        INDEX=1
    fi
    IMAGE_NAME="$1"
    # get all matching images, then pop off the first two as "current" and "rollback" images
    ALL_IMAGES=($(get_matching_image_ids $IMAGE_NAME))
    RELEASE_IMAGE_ID="${ALL_IMAGES[$INDEX]}"
    ALL_IMAGES=("${ALL_IMAGES[@]:$INDEX}") # remove first element and reindex
    ROLLBACK_IMAGE_ID="${ALL_IMAGES[$INDEX]}"
    ALL_IMAGES=("${ALL_IMAGES[@]:$INDEX}")
    RELEASE_IMAGE_NAME=$(get_image_tag_from_id $RELEASE_IMAGE_ID)
    ROLLBACK_IMAGE_NAME=$(get_image_tag_from_id $ROLLBACK_IMAGE_ID)
    echo "Keeping $RELEASE_IMAGE_NAME as current, $ROLLBACK_IMAGE_NAME as rollback"
    for IMAGE in $ALL_IMAGES; do
        IMAGE_TAG=$(get_image_tag_from_id $IMAGE)
        echo "Removing obsolete image $IMAGE_TAG"
        docker rmi $IMAGE
    done
    # prune unused image layers and volumes
    echo "pruning orphaned image layers"
    docker image prune --force
    echo "pruning orphaned volumes"
    docker volume prune --force
}

# use docker inspect to get an image tag from ID
function get_image_tag_from_id {
    IMAGE_ID="$1"
    echo $(docker image inspect $IMAGE_ID | jq '.[0].RepoTags[0]' | sed r/\"//g)
}
