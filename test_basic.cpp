/**
 * @file test_basic.cpp
 * @author your name (you@domain.com)
 * @brief 
 * @version 0.1
 * @date 2024-01-13
 * 
 * @copyright Copyright (c) 2024
 * 
 */

#include <algorithm>
#include <iostream>
#include <vector>

#include <mrf.h>


void print_message(struct Message * msg) {
    std::cout << "message[from = " << msg->from << ", to = " << msg->to << ", values = ";
    for (int ix = 0; ix != msg->dim; ++ix) {
        std::cout << msg->values[ix];
        if (ix != msg->dim - 1) std::cout << ", ";
    }
    std::cout << "]" << std::endl;
}

void print_univariate_marginal(struct Factor1D * fac) {
    std::cout << "Factor1D[";
    for (int ix = 0; ix != fac->dim; ++ix) {
        std::cout << fac->values[ix];
        if (ix != fac->dim - 1) std::cout << ", ";
    }
    std::cout << "]" << std::endl;
}

int test_basic_1() {

    int deg1 = 1, deg2 = 2, deg3 = 1;
    int dim1 = 2, dim2 = 4, dim3 = 3;

    struct Node * n1 = new_node(0, deg1, dim1);
    struct Factor1D * f1 = new_factor1d_uniform_prior(dim1);
    connect_factor1d(n1, f1);

    struct Node * n2 = new_node(1, deg2, dim2);
    struct Factor1D * f2 = new_factor1d_uniform_prior(dim2);
    struct Factor2D * f12 = new_factor2d_uniform_prior(dim1, dim2);
    connect_nodes(n1, n2, f12);
    connect_factor1d(n2, f2);

    struct Node * n3 = new_node(2, deg3, dim3);
    struct Factor1D * f3 = new_factor1d_uniform_prior(dim3);
    struct Factor2D * f23 = new_factor2d_uniform_prior(dim2, dim3);
    connect_nodes(n2, n3, f23);
    connect_factor1d(n3, f3);

    delete_factor1d(f1);
    delete_factor1d(f2);
    delete_factor1d(f3);
    delete_factor2d(f12);
    delete_factor2d(f23);

    delete_node(n1);
    delete_node(n2);
    delete_node(n3);

    return 0;
}

int test_message_product() {
    int d1 = 2, d2 = 3, d3 = 4, d4 = 5;

    struct Node * n1 = new_node(0, 2, d1);
    struct Node * n2 = new_node(1, 2, d2);
    struct Node * n3 = new_node(2, 2, d3);
    struct Node * n4 = new_node(3, 2, d4);

    struct Factor2D * f12 = new_factor2d_uniform_prior(d1, d2);
    struct Factor2D * f23 = new_factor2d_uniform_prior(d2, d3);
    struct Factor2D * f34 = new_factor2d_uniform_prior(d3, d4);
    struct Factor2D * f14 = new_factor2d_uniform_prior(d1, d4);

    connect_nodes(n1, n2, f12);
    connect_nodes(n2, n3, f23);
    connect_nodes(n3, n4, f34);
    connect_nodes(n1, n4, f14);

    // make factors non-uniform for test
    factor2d_ix(f12, 0, 1, 2.0);
    factor2d_ix(f12, 1, 2, 1.5);
    factor2d_ix(f23, 2, 3, 2.5);
    factor2d_ix(f14, 1, 2, 2.0);

    struct Factor1D * f1 = new_factor1d_uniform_prior(d1);
    struct Factor1D * f2 = new_factor1d_uniform_prior(d2);
    struct Factor1D * f3 = new_factor1d_uniform_prior(d3);
    struct Factor1D * f4 = new_factor1d_uniform_prior(d4);

    connect_factor1d(n1, f1);
    connect_factor1d(n2, f2);
    connect_factor1d(n3, f3);
    connect_factor1d(n4, f4);

    factor1d_ix(f1, 1, 4.5);
    factor1d_ix(f4, 1, 2.5);

    struct Node * nodes[] = {n1, n2, n3, n4};
    int num_iterations = 10;
    bp(nodes, 4, num_iterations);

    int dims[] = {d1, d2, d3, d4};
    for (int ix = 0; ix != 4; ++ix) {
        struct Factor1D * marg = new_factor1d(dims[ix]);
        std::cout << "p(x_" << ix + 1 << ") = ";
        compute_univariate_marginal(nodes[ix], marg);
        print_univariate_marginal(marg);
        delete_factor1d(marg);
    }

    int value = 1;
    set_evidence(n3, value);
    // set_evidence(n4, value);
    std::cout << "~ conditioned node " << n2->id << " = " << value << std::endl;

    bp(nodes, 4, num_iterations);

    for (int ix = 0; ix != 4; ++ix) {
        struct Factor1D * marg = new_factor1d(dims[ix]);
        std::cout << "p(x_" << ix + 1 << ") = ";
        compute_univariate_marginal(nodes[ix], marg);
        print_univariate_marginal(marg);
        delete_factor1d(marg);
    }


    delete_factor2d(f12);
    delete_factor2d(f23);
    delete_factor2d(f34);
    delete_factor2d(f14);
    delete_factor1d(f1);
    delete_factor1d(f2);
    delete_factor1d(f3);
    delete_factor1d(f4);

    delete_node(n1);
    delete_node(n2);
    delete_node(n3);
    delete_node(n4);

    return 0;
}


int main(int argc, char ** argv) {
    auto status = std::vector<int>({
        test_basic_1(),
        test_message_product()
    });
    if (*std::max_element(status.begin(), status.end()) > 0) {
        std::cout << "~~~ Test failed; read log for more. ~~~\n";
        return 1;
    } else {
        std::cout << "~~~ All tests passed. ~~~\n";
        return 0;
    }
}