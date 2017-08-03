# Makefile parameters
BUILD_DIR = build
INSTALL_DIR = $(DESTDIR)$(PREFIX)
PREFIX = /usr/local

# the compiler: gcc for C program, define as g++ for C++
CC = gcc

# compiler flags:
CFLAGS = -pthread -Wall
LDFLAGS = -lwiringPi

# generate list of required c binaries
C_BIN = $(basename $(wildcard *.c))
C_BUILD_PATHS = $(addprefix $(BUILD_DIR)/,$(C_BIN))
C_INSTALL_PATHS = $(addprefix $(INSTALL_DIR)/bin/,$(C_BIN))

.PHONY: all
all: $(C_BUILD_PATHS)

$(BUILD_DIR):
	mkdir -p $@

# build rule
$(BUILD_DIR)/%: %.c
	mkdir -p $(BUILD_DIR)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

# install rule
$(INSTALL_DIR)/bin/%: $(BUILD_DIR)/%
	mkdir -p $(dir $@)
	cp $^ $@

.PHONY: install
install: $(C_INSTALL_PATHS)
	sudo chown root:hapadmin $(C_INSTALL_PATHS)
	sudo chmod u+s $(C_INSTALL_PATHS)

.PHONY: clean
clean:
	rm -Rf $(BUILD_DIR)
