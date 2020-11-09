#!/usr/bin/env bash

# script that is called when booting portal in test environment to run all unit tests and integration tests in the correct order as some
# tests change downstream behavior after they've run
#
# can take the following arguments:
#
# -t filepath    Run all tests in the specified file
# -R regex      Run all matching tests in the file specified with -t

while getopts "t:R:" OPTION; do
case $OPTION in
  t)
    TEST_FILEPATH="$OPTARG"
    ;;
  R)
    MATCHING_TESTS="$OPTARG"
    ;;
  esac
done
start=$(date +%s)
RETURN_CODE=0
FAILED_COUNT=0

function clean_up {
  echo "Cleaning up..."
  bundle exec bin/rails runner -e test "Study.delete_all_and_remove_workspaces" || { echo "FAILED to delete studies and workspaces" >&2; exit 1; } # destroy all studies/workspaces to clean up any files
  bundle exec bin/rails runner -e test "BigQueryClient.clear_bq_table" || { echo "FAILED to clear BigQuery table" >&2; exit 1; } # make sure BQ table is cleared
  bundle exec rake RAILS_ENV=test db:purge
  echo "...cleanup complete."
}

clean_up

TMP_PIDS_DIR="/home/app/webapp/tmp/pids"
if [ "$NOT_DOCKERIZED" = "true" ]
then
    TMP_PIDS_DIR="./tmp/pids"
fi

if [[ ! -d "$TMP_PIDS_DIR" ]]
then
    echo "*** MAKING tmp/pids DIR ***"
    mkdir -p "$TMP_PIDS_DIR" || { echo "FAILED to create $TMP_PIDS_DIR" >&2; exit 1; }
    echo "*** COMPLETED ***"
fi
export PASSENGER_APP_ENV=test
echo "*** STARTING DELAYED_JOB for $PASSENGER_APP_ENV env ***"
rm -f "$TMP_PIDS_DIR/delayed_job.*.pid"
bin/delayed_job restart $PASSENGER_APP_ENV -n 6 || { echo "FAILED to start DELAYED_JOB" >&2; exit 1; } # WARNING: using "restart" with environment of test is a HACK that will prevent delayed_job from running in development mode, for example

echo "Precompiling assets, yarn and webpacker..."
RAILS_ENV=test NODE_ENV=test bin/bundle exec rake assets:clean
RAILS_ENV=test NODE_ENV=test bin/bundle exec rake assets:precompile
echo "Generating random seed, seeding test database..."
RANDOM_SEED=$(openssl rand -hex 16)
echo $RANDOM_SEED > /home/app/webapp/.random_seed
bundle exec rake RAILS_ENV=test db:seed || { echo "FAILED to seed test database!" >&2; exit 1; }
bundle exec rake RAILS_ENV=test db:mongoid:create_indexes
echo "Database initialized"
echo "Launching tests using seed: $RANDOM_SEED"
if [ "$TEST_FILEPATH" != "" ]
then
  if [ "$MATCHING_TESTS" != "" ]
  then
    EXTRA_ARGS="-n $MATCHING_TESTS"
  fi
  echo "Running specified tests: $TEST_FILEPATH $EXTRA_ARGS"
  bundle exec ruby -I test $TEST_FILEPATH $EXTRA_ARGS
  code=$? # immediately capture exit code to prevent this from getting clobbered
  if [[ $code -ne 0 ]]; then
    RETURN_CODE=$code
    ((FAILED_COUNT++))
  fi
else
  echo "Running all unit & integration tests..."
  yarn ui-test
  code=$? # immediately capture exit code to prevent this from getting clobbered
  if [[ $code -ne 0 ]]; then
    RETURN_CODE=$code
    first_test_to_fail=${first_test_to_fail-"yarn ui-test"}
    ((FAILED_COUNT++))
  fi
  if [[ "$CODECOV_TOKEN" != "" ]] && [[ "$CI" == "true" ]]; then
    echo "uploading JS coverage to codecov"
    bash <(curl -s https://codecov.io/bash) -cF javascript -t $CODECOV_TOKEN
  fi
  RAILS_ENV=test bundle exec bin/rake test
  code=$?
  if [[ $code -ne 0 ]]; then
    RETURN_CODE=$code
    first_test_to_fail=${first_test_to_fail-"rake test"}
    ((FAILED_COUNT++))
  fi
  if [[ "$CODECOV_TOKEN" != "" ]] && [[ "$CI" == "true" ]]; then
    echo "uploading ruby coverage to codecov"
    bash <(curl -s https://codecov.io/bash) -cF ruby -t $CODECOV_TOKEN
  fi
fi
clean_up
end=$(date +%s)
difference=$(($end - $start))
min=$(($difference / 60))
sec=$(($difference % 60))
echo "Total elapsed time: $min minutes, $sec seconds"
if [[ $RETURN_CODE -eq 0 ]]; then
  printf "\n### All test suites PASSED ###\n\n"
else
  printf "\n### There were $FAILED_COUNT errors/failed test suites in this run, starting with $first_test_to_fail ###\n\n"
fi
echo "Exiting with code: $RETURN_CODE"
exit $RETURN_CODE
