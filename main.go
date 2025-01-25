package main

import (
	"fmt"
	"os"

	"github.com/chandlerroth/current-projects/internal/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
} 