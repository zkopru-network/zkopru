FROM node:13-alpine
RUN apk update && apk add bash
RUN npm install -g circom snarkjs
WORKDIR /proj
COPY ./packages/circuits/package.json /proj/package.json
RUN npm install
COPY ./packages/circuits/impls /proj/impls
COPY ./packages/circuits/lib /proj/lib
RUN mkdir /proj/script
COPY ./packages/circuits/script/compile_circuits.sh /proj/script/compile_circuits.sh
RUN /bin/bash /proj/script/compile_circuits.sh
COPY ./packages/circuits/script/snark_setup.sh /proj/script/snark_setup.sh
RUN /bin/bash /proj/script/snark_setup.sh
CMD /bin/bash