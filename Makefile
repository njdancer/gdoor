# Makefile parameters
BUILD_DIR = build
INSTALL_DIR = $(DESTDIR)$(PREFIX)
SRC_DIR = src
BIN_DIR = bin
PREFIX = /usr/local

# the compiler: gcc for C program, define as g++ for C++
CC = gcc

# compiler flags:
CFLAGS = -pthread -Wall
LDFLAGS = -lwiringPi

# generate list of required c binaries
C_BIN = $(notdir $(C_SRC_PATHS))
C_BUILD_PATHS = $(addprefix $(BUILD_DIR)/,$(C_BIN))
C_INSTALL_PATHS = $(addprefix $(INSTALL_DIR)/bin/,$(C_BIN))
C_SRC_PATHS = $(basename $(wildcard $(SRC_DIR)/*.c))

# generate list of shell scripts
SHELL_BIN = $(notdir $(SHELL_BIN_PATHS))
SHELL_BIN_PATHS = $(wildcard $(BIN_DIR)/*)
SHELL_INSTALL_PATHS = $(addprefix $(INSTALL_DIR)/bin/,$(SHELL_BIN))

.PHONY: all
all: $(C_BUILD_PATHS)

# build rule
$(BUILD_DIR):
	mkdir -p $@

$(BUILD_DIR)/%: $(SRC_DIR)/%.c
	mkdir -p $(BUILD_DIR)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

.PHONY: clean
clean:
	rm -Rf $(BUILD_DIR)

# install rule
$(INSTALL_DIR)/bin/%: $(BUILD_DIR)/%
	mkdir -p $(dir $@)
	cp $^ $@

.PHONY: install
install: $(C_INSTALL_PATHS)
	cp -t $(INSTALL_DIR)/bin $(SHELL_BIN_PATHS)
	sudo chown root:root $(C_INSTALL_PATHS) $(SHELL_INSTALL_PATHS)
	sudo chmod u+s $(C_INSTALL_PATHS)
