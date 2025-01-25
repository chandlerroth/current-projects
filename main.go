package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"os/exec"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "prj",
	Short: "Project management tool",
	Long:  `A CLI tool to manage and organize your git projects.`,
}

var installCmd = &cobra.Command{
	Use:   "install",
	Short: "Install all projects from .current-projects file",
	Run:   runInstall,
}

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize the projects directory and configuration",
	Run:   runInit,
}

func init() {
	rootCmd.AddCommand(installCmd)
	rootCmd.AddCommand(initCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func runInit(cmd *cobra.Command, args []string) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}

	projectsDir := filepath.Join(homeDir, "Projects")
	if err := ensureDirectory(projectsDir); err != nil {
		log.Fatal(err)
	}

	currentProjectsFile := filepath.Join(projectsDir, ".current-projects")
	if _, err := os.Stat(currentProjectsFile); os.IsNotExist(err) {
		f, err := os.Create(currentProjectsFile)
		if err != nil {
			log.Fatal("Failed to create .current-projects file:", err)
		}
		defer f.Close()

		content := `# Add your git repositories here, one per line
# Example:
# git@github.com:username/repo.git
`
		if _, err := f.WriteString(content); err != nil {
			log.Fatal("Failed to write to .current-projects file:", err)
		}
		fmt.Printf("Initialized projects directory at: %s\n", projectsDir)
		fmt.Printf("Created .current-projects file at: %s\n", currentProjectsFile)
		fmt.Println("Add your repositories to this file, one per line")
	} else {
		fmt.Println("Project directory already initialized")
	}
}

func runInstall(cmd *cobra.Command, args []string) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}

	projectsDir := filepath.Join(homeDir, "Projects")
	currentProjectsFile := filepath.Join(projectsDir, ".current-projects")
	
	if _, err := os.Stat(currentProjectsFile); os.IsNotExist(err) {
		fmt.Println("Projects directory not initialized. Please run 'prj init' first")
		os.Exit(1)
	}

	if err := ensureDirectory(projectsDir); err != nil {
		log.Fatal(err)
	}

	repos, err := readRepoList(currentProjectsFile)
	if err != nil {
		log.Fatal(err)
	}

	for _, repo := range repos {
		if err := installRepo(projectsDir, repo); err != nil {
			log.Printf("Error installing %s: %v", repo, err)
		}
	}
}

func ensureDirectory(dir string) error {
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return os.MkdirAll(dir, 0755)
	}
	return nil
}

func readRepoList(file string) ([]string, error) {
	f, err := os.Open(file)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var repos []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" && !strings.HasPrefix(line, "#") {
			repos = append(repos, line)
		}
	}
	return repos, scanner.Err()
}

func installRepo(projectsDir, repoURL string) error {
	// Parse username and repo name from git URL
	parts := strings.Split(repoURL, ":")
	if len(parts) != 2 {
		return fmt.Errorf("invalid git URL format: %s", repoURL)
	}

	pathParts := strings.Split(strings.TrimSuffix(parts[1], ".git"), "/")
	if len(pathParts) != 2 {
		return fmt.Errorf("invalid repository path: %s", repoURL)
	}

	username := pathParts[0]
	repoName := pathParts[1]

	// Create user directory
	userDir := filepath.Join(projectsDir, username)
	if err := ensureDirectory(userDir); err != nil {
		return err
	}

	// Clone repository
	repoPath := filepath.Join(userDir, repoName)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		fmt.Printf("Cloning %s into %s\n", repoURL, repoPath)
		return executeGit("clone", repoURL, repoPath)
	}

	fmt.Printf("Repository already exists at %s\n", repoPath)
	return nil
}

func executeGit(args ...string) error {
	cmd := exec.Command("git", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
} 