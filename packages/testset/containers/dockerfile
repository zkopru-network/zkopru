FROM ubuntu:latest
MAINTAINER Wanseob Lim "email@wanseob.com"

RUN apt-get update \
  && apt-get install -y python3-pip python3-dev git\
  && cd /usr/local/bin \
  && ln -s /usr/bin/python3 python \
  && pip3 install --upgrade pip
RUN git clone https://github.com/Zokrates/pycrypto.git
RUN cd pycrypto && git checkout 07537b5 && cd ..
RUN echo "ethsnarks==0.0.1" >> pycrypto/requirements.txt
RUN pip3 install -r pycrypto/requirements.txt
ENV PYTHONPATH "${PYTHONPATH}:/pycrypto"
COPY ./py934/ ./py934
COPY ./utils/ ./utils
WORKDIR py934

ENTRYPOINT ["python3"]
