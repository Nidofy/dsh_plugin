# Docker Desktop Linux containers; explicit preparation only, never invoked by a lesson.
FROM public.ecr.aws/docker/library/python:3.12.10-slim-bookworm@sha256:fd95fa221297a88e1cf49c55ec1828edd7c5a428187e67b5d1805692d11588db
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1
COPY requirements.lock /tmp/neural-requirements.lock
RUN pip install --no-cache-dir --no-deps --extra-index-url https://download.pytorch.org/whl/cpu -r /tmp/neural-requirements.lock && pip check
WORKDIR /work
USER 65534:65534
