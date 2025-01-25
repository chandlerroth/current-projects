package cmd

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "prj",
	Short: "Project management tool",
	Long:  `A CLI tool to manage and organize your git projects.`,
}

// Execute runs the root command
func Execute() error {
	return rootCmd.Execute()
}

// ... rest of the command code from main.go ... 