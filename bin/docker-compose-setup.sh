#! /bin/sh

# docker-compose-setup.sh
# bring up local development environment via docker-compose
# More context: https://github.com/broadinstitute/single_cell_portal_core#hybrid-docker-local-development

usage=$(
cat <<EOF
$0 [OPTION]
-d   run docker-compose in detached mode (default is attatched to terminal STDOUT)
-c   enable VITE_FRONTEND_SERVICE_WORKER_CACHE (default is disabled)
-h   print this text
EOF
)

DETACHED=""
VITE_FRONTEND_SERVICE_WORKER_CACHE="false"
while getopts "dch" OPTION; do
case $OPTION in
  d)
    echo "### SETTING DETACHED ###"
    DETACHED="--detach"
    echo "### PLEASE ALLOW 30s ONCE SERVICES START BEFORE ISSUING REQUESTS ###"
    ;;
  c)
    echo "### ENABLING VITE_FRONTEND_SERVICE_WORKER_CACHE ###"
    VITE_FRONTEND_SERVICE_WORKER_CACHE="true"
    ;;
  h)
  	echo "$usage"
  	exit 0
  	;;
  *)
  	echo "unrecognized option"
  	echo "$usage"
  	exit 1
  	;;
  esac
done

echo "### SETTING UP ENVIRONMENT ###"
./rails_local_setup.rb --docker-paths
source config/secrets/.source_env.bash
rm tmp/pids/*.pid
echo "### STARTING SERVICES ###"
VITE_FRONTEND_SERVICE_WORKER_CACHE="$VITE_FRONTEND_SERVICE_WORKER_CACHE" \
docker-compose -f docker-compose-dev.yaml up $DETACHED
