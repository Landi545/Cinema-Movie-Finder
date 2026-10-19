# Budowanie silnika konsolowego; backend Electron jest dołączany w main.cpp.
CXX ?= g++
CXXFLAGS ?= -std=c++20 -O2 -Wall -Wextra -pedantic
PKG_CFLAGS := $(shell pkg-config --cflags libcurl libxml-2.0 json-c)
PKG_LIBS := $(shell pkg-config --libs libcurl libxml-2.0 json-c)

all: cinema_movie_finder

.PHONY: all clean

cinema_movie_finder: main.cpp desktop/backend.h
	$(CXX) $(CXXFLAGS) $(PKG_CFLAGS) main.cpp -o $@ $(PKG_LIBS)

clean:
	rm -f cinema_movie_finder
