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

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show git status for all projects",
	Run:   runStatus,
}

var addCmd = &cobra.Command{
	Use:   "add [repo]",
	Short: "Add a repository to projects and install it",
	Args:  cobra.ExactArgs(1),
	Run:   runAdd,
}

const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorBlue   = "\033[34m"
	colorOrange = "\033[33m"
)

func init() {
	rootCmd.AddCommand(installCmd)
	rootCmd.AddCommand(initCmd)
	rootCmd.AddCommand(statusCmd)
	rootCmd.AddCommand(addCmd)
}

// Execute runs the root command
func Execute() error {
	return rootCmd.Execute()
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

	userDir := filepath.Join(projectsDir, username)
	if err := ensureDirectory(userDir); err != nil {
		return err
	}

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

func runStatus(cmd *cobra.Command, args []string) {
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

	repos, err := readRepoList(currentProjectsFile)
	if err != nil {
		log.Fatal(err)
	}

	for _, repo := range repos {
		parts := strings.Split(repo, ":")
		if len(parts) != 2 {
			log.Printf("Skipping invalid repo URL: %s", repo)
			continue
		}

		pathParts := strings.Split(strings.TrimSuffix(parts[1], ".git"), "/")
		if len(pathParts) != 2 {
			log.Printf("Skipping invalid repo path: %s", repo)
			continue
		}

		username := pathParts[0]
		repoName := pathParts[1]
		repoPath := filepath.Join(projectsDir, username, repoName)

		if _, err := os.Stat(repoPath); os.IsNotExist(err) {
			fmt.Printf("%s/%s: Not installed\n", username, repoName)
			continue
		}

		branch, err := executeGitWithOutput(repoPath, "rev-parse", "--abbrev-ref", "HEAD")
		if err != nil {
			log.Printf("Error getting branch for %s: %v", repoPath, err)
			continue
		}
		branch = strings.TrimSpace(branch)

		if err := executeGitQuiet(repoPath, "fetch"); err != nil {
			log.Printf("Error fetching %s: %v", repoPath, err)
			continue
		}

		status := fmt.Sprintf("%s/%s - git:(%s%s%s)",
			username, repoName,
			colorRed, branch, colorReset)

		isClean := true
		behindCount, err := executeGitWithOutput(repoPath, "rev-list", "--count", "HEAD..@{u}")
		if err == nil && strings.TrimSpace(behindCount) != "0" {
			status += fmt.Sprintf(" %s[%s↓]%s", colorBlue, strings.TrimSpace(behindCount), colorReset)
			isClean = false
		}

		aheadCount, err := executeGitWithOutput(repoPath, "rev-list", "--count", "@{u}..HEAD")
		if err == nil && strings.TrimSpace(aheadCount) != "0" {
			status += fmt.Sprintf(" %s[%s↑]%s", colorOrange, strings.TrimSpace(aheadCount), colorReset)
			isClean = false
		}

		changedFiles, err := executeGitWithOutput(repoPath, "status", "--porcelain")
		if err == nil && changedFiles != "" {
			fileCount := len(strings.Split(strings.TrimSpace(changedFiles), "\n"))
			if fileCount > 0 {
				status += fmt.Sprintf(" %s[%d changes]%s", colorRed, fileCount, colorReset)
				isClean = false
			}
		}

		if isClean {
			status += fmt.Sprintf(" %s[✓ clean]%s", colorGreen, colorReset)
		}

		fmt.Println(status)
	}
}

func executeGitWithOutput(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.Output()
	return string(out), err
}

func executeGitQuiet(dir string, args ...string) error {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func runAdd(cmd *cobra.Command, args []string) {
	repoURL := args[0]
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

	repos, err := readRepoList(currentProjectsFile)
	if err != nil {
		log.Fatal(err)
	}

	for _, repo := range repos {
		if repo == repoURL {
			fmt.Println("Repository already exists in projects file")
			return
		}
	}

	f, err := os.OpenFile(currentProjectsFile, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	if _, err := f.WriteString(repoURL + "\n"); err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Added %s to projects file\n", repoURL)

	if err := installRepo(projectsDir, repoURL); err != nil {
		log.Printf("Error installing %s: %v", repoURL, err)
	}
}
