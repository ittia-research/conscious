# Database for production

# Install extensions: AGE, pgvectorscale (with pgvector)
# Reference: 
#   - https://github.com/apache/age/blob/43dcfa57f19a689ef696fad7d3d9b88401f7b2eb/docker/Dockerfile
#   - https://github.com/timescale/pgvectorscale/blob/main/DEVELOPMENT.md
#   - https://github.com/timescale/timescaledb-docker/blob/d74f32024d6af930ad95a71f3e6d717aa75b80bd/Dockerfile


ARG PG_MAJOR=17
# Lock minor version for better stability
ARG PG_MINOR=4


# =================================================================
# ==                          Build AGE                          ==
# =================================================================

FROM postgres:${PG_MAJOR}.${PG_MINOR}-bookworm AS build_age
ARG PG_MAJOR

RUN apt-get update \
    && apt-get install -y --no-install-recommends --no-install-suggests \
       bison \
       build-essential \
       flex \
       postgresql-server-dev-$PG_MAJOR \
       ca-certificates git

RUN git clone https://github.com/apache/age /age

WORKDIR /age

RUN git checkout 43dcfa57f19a689ef696fad7d3d9b88401f7b2eb

RUN make && make install


# =================================================================
# ==                     Build pgvectorscale                     ==
# =================================================================

FROM postgres:${PG_MAJOR}.${PG_MINOR}-bookworm AS build_vector
ARG PG_MAJOR

RUN apt update \
    && apt-get install -y --no-install-recommends --no-install-suggests \
    make gcc pkg-config clang postgresql-server-dev-${PG_MAJOR} libssl-dev \
    curl git jq ca-certificates

# Install rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Download pgvectorscale
RUN cd /tmp \
    && git clone --depth 1 --branch 0.7.0 https://github.com/timescale/pgvectorscale

WORKDIR /tmp/pgvectorscale/pgvectorscale

# Install cargo-pgrx with the same version as pgrx
RUN ~/.cargo/bin/cargo install --locked cargo-pgrx --version $(~/.cargo/bin/cargo metadata --format-version 1 | jq -r '.packages[] | select(.name == "pgrx") | .version')
RUN ~/.cargo/bin/cargo pgrx init --pg${PG_MAJOR} pg_config

# Build pgvectorscale
# TO-DO: warnings during build
RUN RUSTFLAGS="-C target-feature=+avx2,+fma" ~/.cargo/bin/cargo pgrx package

# Build pgvector
RUN cd /tmp \
    && git clone --depth 1 --branch v0.8.0 https://github.com/pgvector/pgvector \
    && cd pgvector \
    && make


# =================================================================
# ==                      Build TimescaleDB                      ==
# =================================================================

FROM postgres:${PG_MAJOR}.${PG_MINOR}-bookworm AS build_timescaledb
ARG PG_MAJOR

RUN apt-get update && apt-get install -y --no-install-recommends --no-install-suggests \
    build-essential \
    cmake \
    libssl-dev \
    postgresql-server-dev-17 \
    git ca-certificates

RUN git clone --branch 2.19.1 --depth 1 https://github.com/timescale/timescaledb /tmp/timescaledb

WORKDIR /tmp/timescaledb

# Build OSS only
RUN ./bootstrap -DCMAKE_BUILD_TYPE=RelWithDebInfo -DREGRESS_CHECKS=OFF -DTAP_CHECKS=OFF \
    -DPROJECT_INSTALL_METHOD="docker" -DAPACHE_ONLY=1
RUN cd ./build \
    && make install \
    && rm -f $(pg_config --pkglibdir)/timescaledb-tsl-*.so


# =================================================================
# ==                         Final Stage                         ==
# =================================================================

FROM postgres:${PG_MAJOR}.${PG_MINOR}-bookworm
ARG PG_MAJOR

# Copy from AGE build
COPY --from=build_age /usr/lib/postgresql/$PG_MAJOR/lib/age.so /usr/lib/postgresql/$PG_MAJOR/lib/
COPY --from=build_age /usr/share/postgresql/$PG_MAJOR/extension/age--*.sql /usr/share/postgresql/$PG_MAJOR/extension/
COPY --from=build_age /usr/share/postgresql/$PG_MAJOR/extension/age.control /usr/share/postgresql/$PG_MAJOR/extension/

# Copy pgvector build
COPY --from=build_vector /tmp/pgvector/vector.so /usr/lib/postgresql/$PG_MAJOR/lib/
COPY --from=build_vector /tmp/pgvector/sql/vector--*.sql /usr/share/postgresql/$PG_MAJOR/extension/
COPY --from=build_vector /tmp/pgvector/vector.control /usr/share/postgresql/$PG_MAJOR/extension/

# Copy pgvectorscale build
COPY --from=build_vector /tmp/pgvectorscale/target/release/vectorscale-pg${PG_MAJOR}/usr/lib/postgresql/${PG_MAJOR}/lib/vectorscale-*.so /usr/lib/postgresql/$PG_MAJOR/lib/
COPY --from=build_vector /tmp/pgvectorscale/target/release/vectorscale-pg${PG_MAJOR}/usr/share/postgresql/${PG_MAJOR}/extension/vectorscale--*.sql /usr/share/postgresql/$PG_MAJOR/extension/
COPY --from=build_vector /tmp/pgvectorscale/target/release/vectorscale-pg${PG_MAJOR}/usr/share/postgresql/${PG_MAJOR}/extension/vectorscale.control /usr/share/postgresql/$PG_MAJOR/extension/

# Copy from timescaledb build
COPY --from=build_timescaledb /usr/lib/postgresql/$PG_MAJOR/lib/timescaledb*.so /usr/lib/postgresql/$PG_MAJOR/lib/
COPY --from=build_timescaledb /usr/share/postgresql/$PG_MAJOR/extension/timescaledb--*.sql /usr/share/postgresql/$PG_MAJOR/extension/
COPY --from=build_timescaledb /usr/share/postgresql/$PG_MAJOR/extension/timescaledb.control /usr/share/postgresql/$PG_MAJOR/extension/

# Copy database initialization scripts for this project
COPY ./initdb.d /docker-entrypoint-initdb.d

CMD ["postgres", "-c", "shared_preload_libraries=age,timescaledb"]