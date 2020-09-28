FROM node:13-alpine as phase1
WORKDIR /proj
RUN apk update && apk add bash git
COPY package.json /proj/package.json
RUN npm install --only=prod
RUN npm install -g circom ./node_modules/circom
RUN npm install -g snarkjs ./node_modules/snarkjs
COPY script/powers_of_tau_phase_1.sh /proj/script/powers_of_tau_phase_1.sh
RUN /bin/bash /proj/script/powers_of_tau_phase_1.sh
CMD /bin/bash

FROM phase1 as phase2
COPY impls/*.circom /proj/impls/
COPY lib /proj/lib
COPY script/compile_circuits.sh /proj/script/compile_circuits.sh
RUN /bin/bash /proj/script/compile_circuits.sh
COPY script/powers_of_tau_phase_2.sh /proj/script/powers_of_tau_phase_2.sh
RUN /bin/bash /proj/script/powers_of_tau_phase_2.sh
CMD /bin/bash
