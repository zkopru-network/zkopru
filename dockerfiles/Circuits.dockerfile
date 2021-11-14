FROM node:16-alpine as phase1
WORKDIR /proj
RUN apk --no-cache add bash git
COPY package.json /proj/package.json
RUN mkdir /utils-docker && echo '{"version": "0.0.0"}' > /utils-docker/package.json
RUN npm install --only=prod \
    && npm install -g circom ./node_modules/circom \
    && npm install -g snarkjs ./node_modules/snarkjs
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
