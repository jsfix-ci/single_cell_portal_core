#!/usr/bin/env bash

# Extract secrets from vault and copy to remote host. Only to be used as a manual process to
# migrate secrets in the case of a failed deployment.

THIS_DIR="$(cd "$(dirname -- "$0")"; pwd)"

# common libraries
. $THIS_DIR/bash_utils.sh
. $THIS_DIR/extract_vault_secrets.sh

function main {

    # defaults
    SSH_USER="docker-user"
    DESTINATION_BASE_DIR='/home/docker-user/deployments/single_cell_portal_core'

    while getopts "p:s:r:e:d:H" OPTION; do
        case $OPTION in
            p)
                PORTAL_SECRETS_VAULT_PATH="$OPTARG"
                ;;
            s)
                SERVICE_ACCOUNT_VAULT_PATH="$OPTARG"
                ;;
            r)
                READ_ONLY_SERVICE_ACCOUNT_VAULT_PATH="$OPTARG"
                ;;
            d)
                DESTINATION_BASE_DIR="$OPTARG"
                ;;
            H)
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

    # exit if all config is not present
    if [[ -z "$PORTAL_SECRETS_VAULT_PATH" ]] || [[ -z "$SERVICE_ACCOUNT_VAULT_PATH" ]] || [[ -z "$READ_ONLY_SERVICE_ACCOUNT_VAULT_PATH" ]]; then
        exit_with_error_message "Did not supply all necessary parameters: portal config: '$PORTAL_SECRETS_VAULT_PATH';" \
            "service account path: '$SERVICE_ACCOUNT_VAULT_PATH'; read-only service account path: '$READ_ONLY_SERVICE_ACCOUNT_VAULT_PATH'$newline$newline$usage"
    fi

    echo "### extracting secrets from vault ###"
    CONFIG_FILENAME="$(set_export_filename $PORTAL_SECRETS_VAULT_PATH env)"
    SERVICE_ACCOUNT_FILENAME="$(set_export_filename $SERVICE_ACCOUNT_VAULT_PATH)"
    READ_ONLY_SERVICE_ACCOUNT_FILENAME="$(set_export_filename $READ_ONLY_SERVICE_ACCOUNT_VAULT_PATH)"
    extract_vault_secrets_as_env_file "$PORTAL_SECRETS_VAULT_PATH"
    extract_service_account_credentials "$SERVICE_ACCOUNT_VAULT_PATH"
    extract_service_account_credentials "$READ_ONLY_SERVICE_ACCOUNT_VAULT_PATH"
    PORTAL_SECRETS_PATH="$DESTINATION_BASE_DIR/config/$CONFIG_FILENAME"
    SERVICE_ACCOUNT_JSON_PATH="$DESTINATION_BASE_DIR/config/$SERVICE_ACCOUNT_FILENAME"
    READ_ONLY_SERVICE_ACCOUNT_JSON_PATH="$DESTINATION_BASE_DIR/config/$READ_ONLY_SERVICE_ACCOUNT_FILENAME"
    echo "### COMPLETED ###"

    # set paths in env file to be correct inside container
    echo "### Exporting Service Account Keys: $SERVICE_ACCOUNT_JSON_PATH, $READ_ONLY_SERVICE_ACCOUNT_JSON_PATH ###"
    echo "export SERVICE_ACCOUNT_KEY=/home/app/webapp/config/$SERVICE_ACCOUNT_FILENAME" >> $CONFIG_FILENAME
    echo "export READ_ONLY_SERVICE_ACCOUNT_KEY=/home/app/webapp/config/$READ_ONLY_SERVICE_ACCOUNT_FILENAME" >> $CONFIG_FILENAME
    echo "### COMPLETED ###"
}

# TODO: Although I made minimum changes to clarify required vs optional parameters, this may now need rewording...
usage=$(
cat <<EOF
USAGE:
   $(basename $0) <required parameters> [<options>]

### extract secrets from vault, copy to remote host, build/stop/remove docker container and launch boot script for deployment ###

[REQUIRED PARAMETERS]
-p VALUE	set the path to configuration secrets in vault
-s VALUE	set the path to the main service account json in vault
-r VALUE	set the path to the read-only service account json in vault

[OPTIONS]
-d VALUE	set the target directory to deploy from (defaults to $DESTINATION_BASE_DIR)
-H COMMAND	print this text
EOF
)

main "$@"
