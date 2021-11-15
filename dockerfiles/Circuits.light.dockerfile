FROM node:16-alpine
WORKDIR /proj
RUN apk add --no-cache bash git curl
COPY package.json /proj/package.json
RUN mkdir /utils-docker && echo '{"version": "0.0.0"}' > /utils-docker/package.json
RUN npm install --only=prod 
RUN npm install -g circom ./node_modules/circom 
RUN npm install -g snarkjs ./node_modules/snarkjs
RUN curl -LJO https://github.com/zkopru-network/zkopru/releases/download/20201112/pot17_final.ptau \
    && mkdir -p /proj/build/ptau \
    && mv pot17_final.ptau /proj/build/ptau/pot17_final.ptau

COPY impls/*.circom /proj/impls/
COPY lib /proj/lib
COPY script/compile_circuits.sh /proj/script/compile_circuits.sh
RUN /bin/bash /proj/script/compile_circuits.sh
COPY script/powers_of_tau_phase_2.sh /proj/script/powers_of_tau_phase_2.sh
RUN /bin/bash /proj/script/powers_of_tau_phase_2.sh
CMD /bin/bash
