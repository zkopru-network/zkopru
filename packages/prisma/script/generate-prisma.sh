#!/bin/bash

BASEDIR=$(dirname "$0")
ARTIFACTS="prisma"
cd $BASEDIR/..
mkdir -p $ARTIFACTS
i=0
for datasource in "datasources"/*.prisma;
do
    # i=$(($i+1))
    artifact="$ARTIFACTS/$(basename "$datasource" ".prisma").prisma"
    echo "// This is an auto generated schema for each datasource." > $artifact
    echo "" >> $artifact
    cat $datasource >> $artifact
    echo "" >> $artifact
    cat "schema.prisma" >> $artifact
    # echo "$artifact"
done
